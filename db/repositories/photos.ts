import { and, desc, eq, getTableColumns, isNotNull, isNull, like, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';
import type { PhotoFilters } from '@/types/geo';

export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

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

  allUris() {
    return db.select({ uri: photos.uri }).from(photos).all();
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  create(data: Omit<NewPhoto, 'id'>) {
    return db.insert(photos).values(data).returning().get();
  },

  update(id: number, data: PhotoChanges) {
    return db.update(photos).set(data).where(eq(photos.id, id));
  },

  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  clearAll() {
    return db.delete(photos);
  },
};
