import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncMeta } from '@/db/schema';

/** Semana 9: pares clave-valor de la sincronización (por ejemplo, el cursor de bajada por usuario). */
export const syncMetaRepo = {
  get(key: string): string | null {
    const row = db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
    return row?.value ?? null;
  },

  set(key: string, value: string) {
    return db
      .insert(syncMeta)
      .values({ key, value })
      .onConflictDoUpdate({ target: syncMeta.key, set: { value } })
      .run();
  },
};
