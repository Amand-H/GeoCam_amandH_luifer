# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 7
**Proyecto:** GeoCam persistente – Taller Integrador 2
**Herramienta:** Claude Code

> El registro de la Semana 6 está en [`docs/ai-log/AI-LOG-semana-6.md`](docs/ai-log/AI-LOG-semana-6.md).

## 1. Prompts Utilizados

- Se le entregó a Claude Code un archivo de instrucciones por fases (`docs/SEMANA7.md`) construido a partir
  de la guía de la Semana 7, con el contexto real del repositorio (SDK 57, rutas en `app/`, sin NativeWind,
  estado en memoria en `GeoPhotosContext`), las reglas obligatorias de la guía y la tabla de errores típicos
  de IA. El prompt fue: *"Lee docs/SEMANA7.md completo y AGENTS.md. Ejecuta las fases en orden, una a la vez.
  Al terminar cada fase: corre `npx tsc --noEmit` y `npx expo lint`, haz el commit indicado y DETENTE en los
  puntos marcados con 🛑 para que yo verifique en el teléfono."*
- En cada punto 🛑 se respondió tras probar en el teléfono ("ya tomé las fotos", "sí", "sí, todo funciona").
  En una ocasión se pegó el aviso de Expo Go *"Cannot connect to Expo CLI"* (apareció durante la prueba en
  modo avión; no era un error de la app).

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** toda la capa de datos y las pantallas nuevas, siguiendo la arquitectura de la guía
  (pantalla → hook → repositorio → Drizzle → expo-sqlite):
  - Configuración: `drizzle.config.ts` (`driver: 'expo'`), `babel.config.js` (`inline-import` para `.sql`),
    `metro.config.js` (`sourceExts.push('sql')`), `types/sql.d.ts` y el script `db:generate`.
  - `db/schema.ts`, `db/client.ts` (`openDatabaseSync` + `enableChangeListener` + `PRAGMA foreign_keys = ON`),
    `db/repositories/photos.ts` y `db/repositories/albums.ts`.
  - Hooks `usePhotos`, `usePhoto`, `useAlbums` (los únicos que usan `useLiveQuery`) y `services/photoFiles.ts`.
  - Pestaña `app/(tabs)/fotos.tsx`, detalle `app/foto/[id].tsx` y componentes `Chip`, `PhotoImage`, `AlbumNameModal`.
  - Las 2 migraciones de `drizzle/` se generaron con `npx drizzle-kit generate`; ninguna se editó a mano.
- **¿Qué se modificó o se decidió distinto respecto al código base de la guía?:**
  - **Mapeo a tipo de dominio:** las pantallas no usan el tipo de Drizzle. `toGeoPhoto()` convierte la fila plana
    (`latitude`, `longitude`, `accuracy`, `created_at` como `Date`) en `GeoPhoto` con `coords` anidadas o `null`
    y `createdAt` en ms. `GeoPhoto.id` pasó de `string` a `number`.
  - **Transacción al borrar un álbum:** `albumsRepo.remove` primero hace `UPDATE photos SET album_id = NULL` y
    luego borra el álbum, dentro de `db.transaction`. Con el driver de Expo la transacción es **síncrona**
    (se usa `.run()` dentro, sin `await`). Ver además el punto 3 sobre `ON DELETE SET NULL`.
  - **Refresco al renombrar un álbum:** se agregó `hooks/useAlbumsVersion.ts`, cuya marca de tiempo se pasa
    como dependencia a las consultas de fotos (ver punto 3).
  - **Nombre duplicado:** Drizzle envuelve el error de SQLite en `DrizzleQueryError`; el mensaje
    `UNIQUE constraint failed` está en `error.cause`. El repositorio recorre la cadena de causas y lanza
    "Ya existe un álbum con ese nombre"; `useAlbums` lo devuelve como texto para el modal.
  - **Filtro "Sin álbum":** `AlbumFilter = number | 'none' | null`, que en el repositorio se traduce a
    `isNull(photos.albumId)`.
  - **`persistPhoto` asíncrono** (ver punto 3). Si el `INSERT` falla, se borra el archivo copiado. `removePhoto`
    lee la fila, borra el registro y después el archivo; `clearAll` obtiene todas las URIs antes de borrar.
    `removePhotoById` se comparte entre el mapa y el detalle para que ambos borren igual.
  - **Placeholder:** `PhotoImage` muestra "No disponible" si la imagen no carga (fotos de las fases 4–5 guardadas
    con URI de caché).
  - **Modal propio** para crear y renombrar álbumes, porque `Alert.prompt` no existe en Android.

## 3. Alucinaciones o Errores Detectados

- **`babel-preset-expo` no estaba instalado como dependencia directa.** Al crear `babel.config.js` con
  `presets: ['babel-preset-expo']`, `npx expo export --platform android` falló con
  `Cannot find module 'babel-preset-expo'`: el paquete solo existía anidado en `node_modules/expo/node_modules`.
  La guía no lo menciona. Se corrigió con `npx expo install babel-preset-expo`.
- **`File.copy()` es asíncrono en SDK 57.** El `persistPhoto` de la guía llamaba `source.copy(destination)`
  como si fuera síncrono y devolvía la URI de inmediato. En los tipos instalados (`expo-file-system` 57.0.7)
  `copy()` devuelve `Promise<void>` (existe `copySync()` aparte). Se hizo `persistPhoto` `async` con `await`.
  Se usó solo la API nueva (`File`, `Directory`, `Paths`); no hay `copyAsync` ni `expo-file-system/legacy`.
- **`drizzle-kit` omitió `ON DELETE SET NULL` en la migración `0001`.** El esquema declara
  `references(() => albums.id, { onDelete: 'set null' })` y el snapshot `drizzle/meta/0001_snapshot.json`
  registra `"onDelete": "set null"`, pero el SQL generado es
  `ALTER TABLE photos ADD album_id integer REFERENCES albums(id);` (sin la cláusula). Se comprobó con SQLite
  (`node:sqlite`) aplicando las migraciones: con `PRAGMA foreign_keys = ON`, borrar directamente un álbum con
  fotos da `FOREIGN KEY constraint failed`. Como la regla es no editar migraciones generadas, la transacción
  del repositorio (desvincular primero) pasó de ser una precaución a ser **necesaria**.
- **`useLiveQuery` solo escucha la tabla del `FROM`.** Leyendo `drizzle-orm/expo-sqlite/query.js`, el listener
  compara `tableName` solo con la tabla principal. Las consultas de fotos hacen `leftJoin(albums)`, así que
  renombrar un álbum no habría actualizado `albumName` en la lista. Se resolvió con `useAlbumsVersion`.
- **La declaración de tipos para `drizzle/migrations.js` no hizo falta.** Las instrucciones anticipaban un
  error de `tsc` al importarlo, pero `expo/tsconfig.base` tiene `allowJs: true` y `types/sql.d.ts` cubre los
  `.sql`, así que no se creó la declaración.
- **`AGENTS.md` dice que las rutas viven en `src/app/`**, pero en este repo están en `app/`. Se siguió la
  estructura real.
- **`npx expo start` reescribió `tsconfig.json`** (quitó `.expo/types/**/*.ts` y `expo-env.d.ts` del `include`).
  Se revirtió y no se incluyó en ningún commit.
- **Commit intermedio sin compilar:** el commit de la fase 3 (`427bdfe`) cambió `GeoPhoto.id` a `number` antes
  de adaptar las pantallas, así que ese commit tiene errores de `tsc` en `mapa.tsx` y en el Context. Se
  corrigieron en el commit siguiente (`fc896fe`) y se dejó anotado en el mensaje del commit.
- **Errores típicos de la tabla de la guía:** en esta sesión no se generó ninguno (`openDatabase`/`executeSql`,
  `better-sqlite3`, `drizzle-kit push`, falta de `driver: 'expo'`, `enableChangeListener` o `PRAGMA`, mezcla de
  APIs de archivos), porque las instrucciones los prevenían explícitamente. Se verificó con `grep` sobre el código.

## 4. Verificación

- En cada fase: `npx tsc --noEmit` y `npx expo lint` sin errores (salvo el commit intermedio indicado arriba),
  y `npx expo export --platform android` para confirmar que Babel y Metro empaquetan los `.sql`.
- `grep -rnE "drizzle|@/db" app components` → solo `app/_layout.tsx` (migraciones).
- En el teléfono (Expo Go):
  - Fase 4: 3 fotos de cámara + 1 de galería; tras cerrar y reabrir Expo Go, el mapa conservó los marcadores;
    en modo avión todo funcionó igual.
  - Fase 5: tras aplicar la migración `0001` en el mismo teléfono, las fotos anteriores siguieron ahí.
  - Fases 6–8: álbumes (crear, duplicado, renombrar, eliminar dejando las fotos sin álbum), nota, favorita,
    búsqueda y filtros; la foto nueva se ve tras reabrir la app y al eliminarla se borra su archivo.
