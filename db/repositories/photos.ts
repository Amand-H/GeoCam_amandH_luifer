import { desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type NewPhoto } from '@/db/schema';

export const photosRepo = {
  /** Consulta sin ejecutar: la ejecuta useLiveQuery para mantenerse reactiva. */
  listQuery() {
    return db.select().from(photos).orderBy(desc(photos.createdAt));
  },

  withLocationQuery() {
    return db
      .select()
      .from(photos)
      .where(isNotNull(photos.latitude))
      .orderBy(desc(photos.createdAt));
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  create(data: Omit<NewPhoto, 'id'>) {
    return db.insert(photos).values(data).returning().get();
  },

  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  clearAll() {
    return db.delete(photos);
  },
};
