import * as Crypto from 'expo-crypto';
import { and, asc, desc, eq, getTableColumns, isNotNull, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';
import type { PhotoFilters } from '@/types/geo';

export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

/** Nunca subida, o editada después de la última sincronización. */
function isPending() {
  return or(isNull(photos.syncedAt), lt(photos.syncedAt, photos.updatedAt));
}

/** Fotos con el nombre de su álbum. La tabla principal sigue siendo photos (la que escucha useLiveQuery). */
function selectWithAlbum() {
  return db
    .select({ ...getTableColumns(photos), albumName: albums.name })
    .from(photos)
    .leftJoin(albums, eq(photos.albumId, albums.id));
}

export const photosRepo = {
  /** Consulta sin ejecutar: la ejecuta useLiveQuery para mantenerse reactiva. */
  listQuery() {
    return selectWithAlbum().orderBy(desc(photos.createdAt));
  },

  withLocationQuery() {
    return selectWithAlbum().where(isNotNull(photos.latitude)).orderBy(desc(photos.createdAt));
  },

  filteredQuery({ search, albumId = null, onlyFavorites = false }: PhotoFilters) {
    const conditions: SQL[] = [];
    const term = search?.trim();
    if (term) conditions.push(like(photos.note, `%${term}%`));
    if (albumId === 'none') conditions.push(isNull(photos.albumId));
    else if (albumId !== null) conditions.push(eq(photos.albumId, albumId));
    if (onlyFavorites) conditions.push(eq(photos.favorite, true));

    return selectWithAlbum()
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(photos.createdAt));
  },

  detailQuery(id: number) {
    return selectWithAlbum().where(eq(photos.id, id)).limit(1);
  },

  /** Pendientes de subir, de la más antigua a la más reciente. */
  pendingForUpload() {
    return selectWithAlbum().where(isPending()).orderBy(asc(photos.createdAt)).all();
  },

  /**
   * Consulta sin ejecutar para useLiveQuery: el botón Sincronizar se actualiza solo.
   * Devuelve uri y remotePath (no un COUNT) porque saber si el archivo existe no lo puede responder SQLite.
   */
  pendingQuery() {
    return db
      .select({ id: photos.id, uri: photos.uri, remotePath: photos.remotePath })
      .from(photos)
      .where(isPending());
  },

  /** Lo necesario para borrar todo: el archivo local y, si se subió, su identidad en la nube. */
  allUris() {
    return db
      .select({ uri: photos.uri, clientId: photos.clientId, remotePath: photos.remotePath })
      .from(photos)
      .all();
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  create(data: Omit<NewPhoto, 'id'>) {
    return db.insert(photos).values(data).returning().get();
  },

  /** Toda edición del usuario renueva updatedAt: así la foto vuelve a quedar pendiente de subir. */
  update(id: number, data: PhotoChanges) {
    return db
      .update(photos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(photos.id, id));
  },

  /** Solo registra la sincronización. No toca updatedAt: si lo hiciera, la foto nunca quedaría al día. */
  markSynced(id: number, remotePath: string) {
    return db.update(photos).set({ remotePath, syncedAt: new Date() }).where(eq(photos.id, id));
  },

  /**
   * Las filas creadas antes de la migración 0003 no tienen clientId ni updatedAt
   * (SQLite no ejecuta $defaultFn al agregar columnas). Se completan una vez al arrancar.
   */
  ensureSyncFields() {
    const rows = db
      .select({ id: photos.id, createdAt: photos.createdAt, updatedAt: photos.updatedAt })
      .from(photos)
      .where(isNull(photos.clientId))
      .all();
    if (rows.length === 0) return 0;
    db.transaction((tx) => {
      for (const row of rows) {
        tx.update(photos)
          .set({ clientId: Crypto.randomUUID(), updatedAt: row.updatedAt ?? row.createdAt })
          .where(eq(photos.id, row.id))
          .run();
      }
    });
    return rows.length;
  },

  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  clearAll() {
    return db.delete(photos);
  },
};
