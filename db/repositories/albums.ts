import { asc, eq } from 'drizzle-orm';
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

export const albumsRepo = {
  listQuery() {
    return db.select().from(albums).orderBy(asc(albums.name));
  },

  async create(name: string) {
    try {
      return await db.insert(albums).values({ name }).returning().get();
    } catch (e) {
      throw readableError(e);
    }
  },

  async rename(id: number, name: string) {
    try {
      await db.update(albums).set({ name }).where(eq(albums.id, id));
    } catch (e) {
      throw readableError(e);
    }
  },

  remove(id: number) {
    // Primero se desvinculan las fotos con una sentencia sobre photos:
    // - useLiveQuery solo se entera de cambios hechos directamente sobre la tabla consultada.
    // - La migración 0001 (ALTER TABLE ... ADD) no incluyó ON DELETE SET NULL, así que
    //   sin este paso SQLite rechazaría borrar un álbum con fotos.
    db.transaction((tx) => {
      tx.update(photos).set({ albumId: null }).where(eq(photos.albumId, id)).run();
      tx.delete(albums).where(eq(albums.id, id)).run();
    });
  },
};
