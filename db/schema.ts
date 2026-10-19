import { index, sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

/**
 * drizzle-kit ejecuta este archivo en Node, donde expo-crypto (módulo nativo) no carga.
 * Por eso se importa solo cuando se genera el valor, es decir, dentro de la app.
 */
function newClientId(): string {
  const Crypto: typeof import('expo-crypto') = require('expo-crypto');
  return Crypto.randomUUID();
}

// albums va antes que photos porque photos la referencia
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photos = sqliteTable(
  'photos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    uri: text('uri').notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    accuracy: real('accuracy'),
    source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    // Si se borra el álbum, la foto queda sin álbum (no se borra)
    albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
    note: text('note'),
    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    // Identidad compartida con la nube: el id autoincremental solo vale en este teléfono
    clientId: text('client_id').unique().$defaultFn(newClientId),
    // Última modificación hecha por el usuario
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
    // Ruta del archivo en el bucket y momento de la última sincronización
    remotePath: text('remote_path'),
    syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  },
  // Las listas se ordenan por fecha descendente: el índice evita ordenar toda la tabla
  (t) => [index('photos_created_at_idx').on(t.createdAt)]
);

export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
