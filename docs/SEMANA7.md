# Instrucciones para Claude Code — Semana 7: GeoCam persistente con Drizzle ORM + SQLite

> **Cómo usar este archivo:** cópialo a la raíz del repo `GeoCam` (por ejemplo como `docs/SEMANA7.md`), abre Claude Code en esa carpeta y pega este prompt:
>
> ```
> Lee docs/SEMANA7.md completo y AGENTS.md. Ejecuta las fases en orden, una a la vez.
> Al terminar cada fase: corre `npx tsc --noEmit` y `npx expo lint`, haz el commit indicado
> y DETENTE en los puntos marcados con 🛑 para que yo verifique en el teléfono.
> ```

---

## 0. Contexto del repositorio (léelo antes de tocar código)

Repo: `https://github.com/lnunez01/GeoCam` — Taller Integrador 2 (Luis Nuñez, Amand Herrera).

| Dato | Valor real del repo |
|---|---|
| Expo SDK | **57** (`expo ~57.0.26`), React 19.2, RN 0.86, TypeScript strict |
| Rutas | `app/` en la raíz (NO `src/app/`, aunque AGENTS.md diga eso) |
| Alias | `@/*` → raíz del proyecto (`tsconfig.json`) |
| Tabs | `import { Tabs } from 'expo-router/js-tabs'` (el de `expo-router` está deprecado en SDK 57) |
| Estilos | `StyleSheet` + `constants/theme.ts` (**no hay NativeWind**) |
| Babel / Metro | **No existen** `babel.config.js` ni `metro.config.js` → hay que crearlos |
| Estado actual de fotos | En memoria: `context/GeoPhotosContext.tsx` (`GeoPhotosProvider` en `app/(tabs)/_layout.tsx`) |
| Tipo actual | `types/geo.ts` → `GeoPhoto { id: string; uri; coords: Coords \| null; source; createdAt: number }` |
| Helpers | `lib/photos.ts` → `createGeoPhoto`, `pickImageFromGallery`, `confirmClearAll` |
| Pantallas | `app/(tabs)/geocam.tsx` (cámara), `app/(tabs)/mapa.tsx` (mapa + "Sin ubicación") |
| Shake | `hooks/useShake.ts` → hoy llama `clearAll` del Context |

**Reglas de AGENTS.md que aplican:** instalar paquetes Expo siempre con `npx expo install`; antes de usar una API de Expo, consultar la doc versionada `https://docs.expo.dev/versions/v57.0.0/` (en especial `sdk/sqlite` y `sdk/filesystem`); correr lint + typecheck antes de dar algo por terminado.

---

## 1. Reglas obligatorias de la guía (no negociables)

1. **Capas:** Pantalla (`app/`) → Hook (`hooks/`) → Repositorio (`db/repositories/`) → Drizzle + esquema (`db/`) → expo-sqlite.
   **Ninguna pantalla ni componente importa nada de `drizzle-orm` ni de `db/`** (ni siquiera `useLiveQuery`). Todo `useLiveQuery` vive en hooks.
2. **Migraciones:** solo con `npx drizzle-kit generate`. **Nunca** editar a mano un `.sql` generado ni `drizzle/migrations.js`. **Nunca** usar `drizzle-kit push`. La carpeta `drizzle/` se versiona en Git.
3. Driver correcto: `drizzle-orm/expo-sqlite` (NO `drizzle-orm/better-sqlite3`).
4. Abrir la base con `openDatabaseSync('geocam.db', { enableChangeListener: true })` (NO `SQLite.openDatabase` ni `db.transaction(tx => tx.executeSql())`, API retirada).
5. Ejecutar `PRAGMA foreign_keys = ON;` justo después de abrir la conexión.
6. `drizzle.config.ts` con `driver: 'expo'` (si falta, no se genera `migrations.js`).
7. Coordenadas en `real` (sí son decimales).
8. expo-file-system: usar **una sola API** — la nueva (`File`, `Directory`, `Paths` desde `expo-file-system`). Prohibido mezclar con `FileSystem.copyAsync` / `expo-file-system/legacy`. Verificar en la doc de SDK 57 antes de escribir.
9. Después de crear/cambiar Babel o Metro: `npx expo start -c`.

### Errores típicos de IA que debes evitar (y si cometes alguno, anótalo para el AI-LOG)

| La IA genera | Corrección |
|---|---|
| `SQLite.openDatabase` / `tx.executeSql` | `openDatabaseSync` |
| `drizzle-orm/better-sqlite3` | `drizzle-orm/expo-sqlite` |
| `drizzle.config.ts` sin `driver: 'expo'` | Agregarlo |
| Falta `inline-import` en Babel o `sql` en Metro | Configurar ambos |
| `npx drizzle-kit push` | `generate` + `useMigrations` |
| Abrir sin `enableChangeListener` | `useLiveQuery` no se actualiza |
| Llaves foráneas sin PRAGMA | SQLite las ignora |
| `FileSystem.copyAsync` + `new File()` | Una sola API |

Lleva una lista interna de cada error que detectes y corrijas en el camino; se usa en la Fase 9 (AI-LOG).

---

## 2. Plan de migraciones (importante para cumplir la guía)

| Migración | Fase | Contenido |
|---|---|---|
| `0000_*` | Fase 2 (taller) | Tabla `photos` (esquema de partida de la guía) |
| `0001_*` | Fase 5 (casa C1 + C2) | Tabla `albums` + columnas `album_id`, `note`, `favorite` en `photos` → **"segunda migración"** |
| `0002_*` | Fase 10 (reto opcional) | Índice sobre `photos.created_at` → **"tercera migración"** |

La migración `0001` debe generarse y aplicarse **sobre un teléfono que ya tenga fotos** guardadas con la `0000`.

---

## FASE 1 — Configuración (T1)

Crear rama: `git checkout -b semana-7-drizzle`.

```bash
npx expo install expo-sqlite expo-file-system
npm install drizzle-orm
npm install -D drizzle-kit babel-plugin-inline-import
npx expo customize metro.config.js
```

**`drizzle.config.ts`** (raíz):
```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

**`babel.config.js`** (no existe; crearlo — no hay NativeWind que fusionar):
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
```

**`metro.config.js`**: el generado por `expo customize` + `config.resolver.sourceExts.push('sql');`.

**Tipos:** crear `types/sql.d.ts` con `declare module '*.sql' { const content: string; export default content; }`. Si `tsc` se queja al importar `@/drizzle/migrations` (archivo `.js` sin tipos), resolverlo con un archivo de declaración en `types/` (p. ej. `declare module '@/drizzle/migrations'` con el tipo que espera `useMigrations`), **nunca** editando archivos dentro de `drizzle/`.

Agregar al `package.json` el script `"db:generate": "drizzle-kit generate"`.

✅ Commit: `chore(db): configurar expo-sqlite, drizzle-orm, babel y metro`

---

## FASE 2 — Esquema inicial, cliente y migraciones (T1 + T2)

**`db/schema.ts`** (esquema de partida, exactamente este para la `0000`):
```ts
import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uri: text('uri').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
```

Ejecutar `npx drizzle-kit generate` → debe aparecer `drizzle/0000_*.sql`, `drizzle/meta/` y `drizzle/migrations.js`. Revisar que el `.sql` sea el `CREATE TABLE` esperado.

**`db/client.ts`:**
```ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const expoDb = openDatabaseSync('geocam.db', { enableChangeListener: true });
// SQLite no aplica llaves foráneas a menos que se active en cada conexión
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });
```

**`app/_layout.tsx`** — proteger con `useMigrations(db, migrations)`:
- Mientras `!success` → `ActivityIndicator` centrado sobre fondo `colors.background`.
- Si `error` → texto "Error al preparar la base de datos: {error.message}".
- Solo con `success` se monta el `<Stack screenOptions={{ headerShown: false }} />` + `StatusBar` actuales.
- (El layout raíz es la única excepción permitida que importa `db` y el migrator, igual que en la guía.)

✅ Commit: `feat(db): esquema photos, cliente drizzle y migración inicial`

---

## FASE 3 — Repositorio y hook (T3 + T4)

**`db/repositories/photos.ts`** → objeto `photosRepo` con:
- `listQuery()` — todas las fotos, `orderBy(desc(photos.createdAt))`. Devuelve la consulta **sin ejecutar**.
- `withLocationQuery()` — solo `where(isNotNull(photos.latitude))`, mismo orden. Sin ejecutar.
- `findById(id: number)` — `.get()`.
- `create(data: Omit<NewPhoto, 'id'>)`
- `remove(id: number)`
- `clearAll()`

**`types/geo.ts`** — actualizar el tipo de dominio que usan las pantallas (para que no dependan de Drizzle):
```ts
export interface GeoPhoto {
  id: number;                 // antes string
  uri: string;
  coords: Coords | null;
  source: 'camera' | 'gallery';
  createdAt: number;          // ms
}
```

**`hooks/usePhotos.ts`** — expone `photos`, `photosWithLocation`, `addPhoto(input)`, `removePhoto(id)`, `clearAll()`, `error`:
- Usa `useLiveQuery(photosRepo.listQuery())` y `useLiveQuery(photosRepo.withLocationQuery())`.
- Mapea filas planas → `GeoPhoto` con `useMemo` (`latitude/longitude/accuracy` → `coords` o `null`; `createdAt.getTime()`; `timestamp` = `createdAt`).
- `addPhoto({ uri, source, coords }: { uri: string; source: 'camera' | 'gallery'; coords: Coords | null })` convierte a columnas planas: `latitude: coords?.latitude ?? null`, igual con `longitude` y `accuracy`.
- Acciones con `useCallback`.

✅ Commit: `feat(db): repositorio de fotos y hook usePhotos`

---

## FASE 4 — Integración en pantallas (T5) + verificación (T6)

- `app/(tabs)/_layout.tsx`: quitar `GeoPhotosProvider`.
- `app/(tabs)/geocam.tsx`: reemplazar `useGeoPhotos()` por `usePhotos()`; `handleImport` y `handleCapture` llaman `addPhoto({ uri, source, coords: await resolveCoords() })`. Dejar de usar `createGeoPhoto`.
- `app/(tabs)/mapa.tsx`: los marcadores salen de `photosWithLocation`; la lista "Sin ubicación" filtra `photos` con `coords === null`; `selectedId` pasa a `number | null`; `keyExtractor={(i) => String(i.id)}`.
- `useShake` en ambas pantallas → `confirmClearAll(photos.length, clearAll)` con el `clearAll` del hook (que llama al repositorio).
- Eliminar `context/GeoPhotosContext.tsx` y `createGeoPhoto` de `lib/photos.ts` (y el contador).
- `grep -r "drizzle\|@/db" app components` debe dar **cero** resultados, excepto `app/_layout.tsx`.

`npx tsc --noEmit` + `npx expo lint` sin errores. `npx expo start -c`.

🛑 **PUNTO DE VERIFICACIÓN (lo hace el estudiante en el teléfono):**
1. Tomar 3 fotos (al menos una con ubicación) e importar 1 de galería.
2. Cerrar Expo Go por completo, volver a abrir → el mapa conserva los marcadores.
3. Modo avión → todo funciona igual.
4. **NO borrar estas fotos**: se usan para probar la segunda migración.

✅ Commit: `feat: GeoCam persistente con SQLite (taller en clase)` — este es el entregable del taller.

---

## FASE 5 — Segunda migración: álbumes, nota y favorita (C1 + C2)

Modificar `db/schema.ts` (definir `albums` **antes** de `photos`):
```ts
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// en photos, agregar:
albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }), // opcional
note: text('note'),                                                                  // opcional
favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
```
Exportar también `Album`, `NewAlbum`.

Ejecutar `npx drizzle-kit generate` → `drizzle/0001_*.sql`. **Leer el SQL generado** y explicarme si usa `ALTER TABLE ... ADD` o recrea la tabla (`__new_photos` + `INSERT INTO ... SELECT`); en ambos casos los datos deben conservarse. No editarlo.

🛑 **PUNTO DE VERIFICACIÓN:** recargar en el MISMO teléfono de la Fase 4 → las fotos anteriores siguen ahí con `favorite = false`, `note = null`, `albumId = null`.

✅ Commit: `feat(db): segunda migración — tabla albums, nota y favorita`

---

## FASE 6 — Repositorios y hooks ampliados (C1, C3, C4)

**`db/repositories/albums.ts`** → `albumsRepo`: `listQuery()` (orden por nombre), `create(name)`, `rename(id, name)`, `remove(id)`.
- En `remove`: dentro de `db.transaction`, primero `update photos set album_id = null where album_id = id` y luego borrar el álbum. Motivo: `useLiveQuery` solo se refresca con cambios hechos por sentencias sobre la tabla consultada; los cambios disparados por la acción de la FK podrían no notificar. El `onDelete: 'set null'` se mantiene como garantía en la base.
- Nombre duplicado → capturar el error de `UNIQUE` y devolver un mensaje legible ("Ya existe un álbum con ese nombre").

**`db/repositories/photos.ts`** — agregar:
- `listQuery` ahora con `leftJoin(albums, eq(photos.albumId, albums.id))` y devuelve también `albumName`.
- `filteredQuery({ search, albumId, onlyFavorites })` combinando con `and(...)`: `like(photos.note, \`%${search}%\`)` si hay búsqueda; `eq(photos.albumId, albumId)` si hay álbum (opcional: valor especial para "sin álbum" con `isNull`); `eq(photos.favorite, true)` si aplica.
- `detailQuery(id)` (con join a álbum), `update(id, data: Partial<...>)` para `note`, `favorite`, `albumId`.

**Hooks** (únicos que usan `useLiveQuery`):
- `usePhotos({ search, albumId, onlyFavorites })` → usa `useLiveQuery(photosRepo.filteredQuery(filtros), [search, albumId, onlyFavorites])` para que se recalcule al cambiar filtros (requisito C4). Mantiene `photosWithLocation` para el mapa.
- `usePhoto(id)` → detalle reactivo + `updateNote`, `toggleFavorite`, `moveToAlbum`, `remove`.
- `useAlbums()` → `albums`, `createAlbum`, `renameAlbum`, `removeAlbum`.
- Extender `GeoPhoto` en `types/geo.ts` con `note: string | null`, `favorite: boolean`, `albumId: number | null`, `albumName: string | null`, y agregar `interface Album { id: number; name: string; createdAt: number }`.

✅ Commit: `feat(db): repositorio de álbumes, filtros y actualización de fotos`

---

## FASE 7 — Pantallas CRUD (C3 + C4)

Estilo: `StyleSheet` + `colors` de `constants/theme.ts`, tema oscuro igual al resto.

1. **Nueva pestaña `app/(tabs)/fotos.tsx`** (icono 🗂️, registrarla en `(tabs)/_layout.tsx`):
   - Buscador por nota (`TextInput`).
   - Chips de filtro: "Todos", "Sin álbum", cada álbum, y toggle "★ Favoritas".
   - Botón "+ Álbum" (prompt con `TextInput` en un modal simple; `Alert.prompt` no existe en Android).
   - Mantener presionado un chip de álbum → confirmar eliminar ("Las fotos quedarán sin álbum, no se borran").
   - Grilla/lista de fotos (miniatura, ★, 📍/∅, álbum, primeras palabras de la nota). Tocar → `router.push({ pathname: '/foto/[id]', params: { id: String(p.id) } })`.
   - `ListEmptyComponent` según el filtro.
2. **`app/foto/[id].tsx`** (en el Stack raíz, con header visible y título "Foto"):
   - Imagen grande, fecha `toLocaleString('es-CO')`, origen, coordenadas.
   - Editar nota (`TextInput` multilinea + botón Guardar).
   - Toggle favorita.
   - Selector de álbum (chips, incluido "Sin álbum").
   - Eliminar con `Alert` de confirmación → `router.back()`.
   - Si la foto no existe (ya borrada) → mensaje y botón volver.
3. En `mapa.tsx`, el preview de la foto seleccionada agrega "Ver detalle" → `/foto/[id]`.

✅ Commit: `feat: pantalla de detalle, pestaña Fotos con búsqueda y filtros por álbum/favoritas`

---

## FASE 8 — Archivos permanentes (C5)

Antes de escribir código, **consultar la doc de `expo-file-system` para SDK 57** y confirmar la API de `File`, `Directory`, `Paths` (`copy`, `delete`, `exists`, `create`).

**`services/photoFiles.ts`** (base de la guía, ajustada a la doc real):
```ts
import { Directory, File, Paths } from 'expo-file-system';

const photosDir = new Directory(Paths.document, 'photos');

export function persistPhoto(cacheUri: string): string {
  if (!photosDir.exists) photosDir.create();
  const source = new File(cacheUri);
  const ext = source.extension || '.jpg';
  const destination = new File(photosDir, `${Date.now()}${ext}`);
  source.copy(destination);
  return destination.uri;
}

export function deletePhotoFile(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
```
- Aplica a fotos de **cámara y galería** (ambas llegan en caché).
- La lógica de archivos va en el **hook/servicio**, no en las pantallas ni en el repositorio de Drizzle: `addPhoto` → `persistPhoto` → `photosRepo.create({ uri: nuevaUri, ... })`. Si el insert falla, borrar el archivo copiado.
- `removePhoto(id)` → leer la fila, borrar registro y luego `deletePhotoFile(uri)` (tolerar que no exista).
- `clearAll()` → obtener todas las URIs, borrar registros y luego archivos.
- Fotos antiguas guardadas con URI de caché (Fases 4–5): si el archivo ya no existe, la UI muestra un placeholder en vez de romperse.

🛑 **PUNTO DE VERIFICACIÓN:** tomar foto → cerrar app → reabrir → se ve. Eliminarla → (opcional) confirmar en consola con `__DEV__` que el archivo ya no existe.

✅ Commit: `feat: copiar fotos a la carpeta de documentos y borrar archivo con su registro`

---

## FASE 9 — Documentación (C6)

1. Mover el AI-LOG actual (Semana 6) a `docs/ai-log/AI-LOG-semana-6.md`.
2. Nuevo **`AI-LOG.md`** en la raíz, formato de la guía:
   ```
   # Registro de Auditoría de IA (AI-LOG)
   **Estudiante(s):** Luis Nuñez, Amand Herrera
   **Semana:** 7
   **Proyecto:** GeoCam persistente – Taller Integrador 2
   **Herramienta:** Claude Code
   ## 1. Prompts Utilizados
   ## 2. Código Generado vs. Código Modificado
   ## 3. Alucinaciones o Errores Detectados
   ```
   Llenarlo con lo que realmente pasó en esta sesión (errores de la lista de la sección 1, decisión de la transacción al borrar álbum, declaración de tipos para `migrations.js`, mapeo de `GeoPhoto`, etc.). **No inventar errores que no ocurrieron.**
3. **`README.md`** — agregar sección "Semana 7 – Persistencia offline-first":
   - Diagrama de tablas en Mermaid (`erDiagram`: `ALBUMS ||--o{ PHOTOS`, con columnas y tipos).
   - Arquitectura por capas (pantalla → hook → repositorio → drizzle → sqlite) y estructura de carpetas `db/`, `drizzle/`, `hooks/`, `services/`.
   - Cómo generar migraciones (`npm run db:generate`) y advertencia de no usar `push`.
   - Lista de migraciones y qué hace cada una.
   - Espacio para el GIF: `![Flujo CRUD](docs/screenshots/flujo-semana7.gif)` — **el GIF lo graban los estudiantes**; dejar el enlace preparado.

✅ Commit: `docs: README con diagrama de tablas y AI-LOG semana 7`

---

## FASE 10 — Reto opcional (tercera migración + rendimiento)

1. En `photos`, agregar índice con el tercer argumento de `sqliteTable`: `(t) => [index('photos_created_at_idx').on(t.createdAt)]`.
2. **Antes** de generar: crear `db/devSeed.ts` con `seedFakePhotos(1000)` (inserta en lotes dentro de una transacción, URIs ficticias, coordenadas aleatorias cerca de Riohacha 11.5444, -72.9072) y `measureList()` con `console.time('listar 1000 fotos')` sobre `photosRepo.listQuery()`. Exponerlo solo en `__DEV__` (por ejemplo un botón oculto en la pestaña Fotos). Medir y anotar el tiempo SIN índice.
3. `npx drizzle-kit generate` → `0002_*.sql` con `CREATE INDEX`. Medir de nuevo y anotar CON índice.
4. Agregar los dos tiempos al README y botón dev para borrar los datos de prueba.

✅ Commit: `perf(db): tercera migración con índice en created_at y medición`

---

## Checklist final antes de entregar (verificar uno por uno)

- [ ] Hay al menos dos migraciones en `drizzle/`, generadas con `drizzle-kit generate`, ninguna editada a mano, todas versionadas.
- [ ] Las fotos de antes de la segunda migración siguen ahí después de aplicarla.
- [ ] Las pantallas no importan nada de Drizzle (`grep` limpio salvo `app/_layout.tsx`).
- [ ] Crear, leer, actualizar (nota, favorita, álbum) y borrar funcionan; los filtros y la búsqueda se actualizan solos.
- [ ] Borrar un álbum deja sus fotos sin álbum (no las borra).
- [ ] Las fotos se guardan en la carpeta de documentos y el archivo se borra junto con su registro (también con shake → borrar todo).
- [ ] El mapa conserva los marcadores tras cerrar y reabrir Expo Go; funciona en modo avión.
- [ ] `README.md` y `AI-LOG.md` en la raíz.
- [ ] `npx tsc --noEmit`, `npx expo lint` y `npx expo-doctor` sin errores.
- [ ] Push de la rama y merge a `main` (o PR) → enlace del repo para entregar antes de la clase de la Semana 8.

## Si algo falla

- **"no such table"** → la migración no se aplicó: revisar que `migrations.js` se importa en `app/_layout.tsx` y reiniciar con `npx expo start -c`.
- **Error al importar `.sql`** → falta el plugin `inline-import` o `sql` en `sourceExts`; reiniciar con caché limpia.
- **La lista no se actualiza** → falta `enableChangeListener: true` o el `useLiveQuery` no recibe las dependencias de los filtros.
- **No se respeta la FK** → falta `PRAGMA foreign_keys = ON` en `db/client.ts`.
- **Error de base corrupta durante desarrollo** → no borrar migraciones; en último caso borrar los datos de Expo Go en el teléfono, nunca reescribir la historia de `drizzle/`.
