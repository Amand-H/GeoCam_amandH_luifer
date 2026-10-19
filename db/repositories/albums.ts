import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos } from '@/db/schema';

/** Recorre la cadena de causas: Drizzle envuelve el error de SQLite en DrizzleQueryError. */
function isUniqueViolation(e: unknown): boolean {
  let current: unknown = e;
  while (current instanceof Error) {
    if (current.message.includes('UNIQUE constraint failed')) return true;
    current = current.cause;
  }
  return false;
}

function readableError(e: unknown): Error {
  if (isUniqueViolation(e)) return new Error('Ya existe un álbum con ese nombre');
  return e instanceof Error ? e : new Error('No se pudo guardar el álbum');
}

/** Un álbum concreto del usuario: un id de otra cuenta no encuentra nada. */
function ownAlbum(id: number, ownerId: string) {
  return and(eq(albums.id, id), eq(albums.ownerId, ownerId));
}

export const albumsRepo = {
  listQuery(ownerId: string) {
    return db.select().from(albums).where(eq(albums.ownerId, ownerId)).orderBy(asc(albums.name));
  },

  async create(name: string, ownerId: string) {
    try {
      return await db.insert(albums).values({ name, ownerId }).returning().get();
    } catch (e) {
      throw readableError(e);
    }
  },

  async rename(id: number, ownerId: string, name: string) {
    try {
      await db.update(albums).set({ name }).where(ownAlbum(id, ownerId));
    } catch (e) {
      throw readableError(e);
    }
  },

  remove(id: number, ownerId: string) {
    // Primero se desvinculan las fotos con una sentencia sobre photos:
    // - useLiveQuery solo se entera de cambios hechos directamente sobre la tabla consultada.
    // - La migración 0001 (ALTER TABLE ... ADD) no incluyó ON DELETE SET NULL, así que
    //   sin este paso SQLite rechazaría borrar un álbum con fotos.
    db.transaction((tx) => {
      tx.update(photos)
        .set({ albumId: null })
        .where(and(eq(photos.albumId, id), eq(photos.ownerId, ownerId)))
        .run();
      tx.delete(albums).where(ownAlbum(id, ownerId)).run();
    });
  },

  /** Álbumes de antes de la Semana 8 (sin dueño): pasan a ser del usuario indicado. */
  claimOrphans(ownerId: string) {
    return db.update(albums).set({ ownerId }).where(isNull(albums.ownerId)).run();
  },
};
