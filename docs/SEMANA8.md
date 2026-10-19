# Instrucciones para Claude Code — Semana 8: GeoCam en la nube con Supabase

> **Cómo usar este archivo:** guárdalo en el repo como `docs/SEMANA8.md`, abre Claude Code en la raíz del proyecto y pega:
>
> ```
> Lee docs/SEMANA8.md completo, AGENTS.md y docs/SEMANA7.md. Ejecuta las fases en orden, una a la vez.
> Al terminar cada fase: corre `npx tsc --noEmit` y `npx expo lint`, haz el commit indicado
> y DETENTE en cada 🛑 para que yo haga la parte manual (panel de Supabase o prueba en el teléfono).
> Responde siempre en español.
> ```

---

## 0. Estado real del repositorio (léelo antes de tocar código)

Repo: `https://github.com/Amand-H/GeoCam_amandH_luifer` — Taller Integrador 2 (Luis Nuñez, Amand Herrera).

| Dato | Valor real |
|---|---|
| Semana 7 | **Terminada** (C1–C5 + reto). No rehacer nada de ella |
| Expo SDK | 57 (`expo ~57.0.27`), React 19.2, RN 0.86, TypeScript strict |
| Rutas | `app/` en la raíz (no `src/app/`). Tabs: `geocam`, `mapa`, `fotos`. Stack: `foto/[id]` |
| Tabs | `import { Tabs } from 'expo-router/js-tabs'` |
| Estilos | **`StyleSheet` + `constants/theme.ts`** (tema oscuro). **No hay NativeWind** → la guía pide el login "con NativeWind"; aquí se hace con `StyleSheet` para no meter una dependencia nueva. Anotarlo en el AI-LOG |
| Layout raíz | `app/_layout.tsx` ejecuta `useMigrations(db, migrations)` y luego un `<Stack>` sin protección |
| `app/index.tsx` | `<Redirect href="/geocam" />` |
| SQLite | `db/schema.ts` (`albums`, `photos`), `db/client.ts` (WAL + `foreign_keys`), repos en `db/repositories/` |
| Migraciones | `0000`, `0001`, `0002` en `drizzle/` → **no tocar, no regenerar, no borrar** |
| Hooks de datos | `usePhotos`, `usePhoto`, `useAlbums`, `useAlbumsVersion` (todo `useLiveQuery` vive aquí) |
| Archivos | `services/photoFiles.ts` (API nueva `File/Directory/Paths`; las fotos están en `Paths.document/photos`) |
| `.gitignore` | Solo ignora `.env*.local` → **`.env` todavía no está ignorado** |
| Tipos de dominio | `types/geo.ts` (`GeoPhoto`, `Album`, `PhotoFilters`) |

**Reglas de AGENTS.md:** instalar con `npx expo install`; consultar la documentación de la versión (`https://docs.expo.dev/versions/v57.0.0/`) antes de usar APIs de Expo (`sdk/securestore`, `sdk/crypto`, `sdk/network`, `router/advanced/protected`); lint + typecheck antes de dar algo por terminado.

**Referencia:** el proyecto de ejemplo `muro-de-clase` (zip de la clase) tiene `lib/secureStorage.ts`, `lib/supabase.ts`, `context/AuthContext.tsx` y `.gitignore` probados con SDK 57 y `.npmrc` con `legacy-peer-deps=true`. Si `npx expo install` falla por dependencias peer, crear el mismo `.npmrc`.

---

## 1. Reglas obligatorias (no negociables)

1. **Capas:** Pantalla → Hook → Servicio/Repositorio → Supabase o Drizzle. Las pantallas **no importan** `@/lib/supabase`, `@supabase/supabase-js`, `drizzle-orm` ni `@/db/...`. Excepción: `app/_layout.tsx` (migraciones + `AuthProvider`). Solo `services/cloudPhotos.ts`, `context/AuthContext.tsx` y los hooks hablan con Supabase.
2. **Llaves:** en la app solo van `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Nunca** una secret key / `service_role` ni la contraseña de la base, con ningún nombre, en ningún archivo.
3. **`.env` en `.gitignore` ANTES de crear `.env`.** Se versiona `.env.example` sin valores.
4. **Sesión:** `lib/secureStorage.ts` (SecureStore por fragmentos de 1000). **Nunca** `AsyncStorage` ni `storage: SecureStore` directo. `detectSessionInUrl: false`.
5. **API de supabase-js v2:** `getSession()`, `getUser()`, `onAuthStateChange`. Nada de `supabase.auth.session()` / `.user()`. Nada de `@supabase/auth-helpers-*`.
6. **Navegación:** `Stack.Protected` con `guard`. **Nada de `router.replace` después del login o el logout.**
7. **Subidas como `ArrayBuffer`** (`fetch(uri).then(r => r.arrayBuffer())`). Nunca `Blob` ni `FormData` (generan archivos de 0 bytes).
8. **RLS nunca se desactiva.** Si algo falla por RLS, se corrige la ruta o se agrega la política que falta. Nunca `using (true)` para insert/update/delete.
9. **Realtime:** todo canal se cierra con `supabase.removeChannel(channel)` en la limpieza del `useEffect`.
10. **Migraciones locales:** solo `npm run db:generate`. Nunca editar `.sql` generados ni `drizzle/migrations.js`. Nunca `drizzle-kit push`.
11. Después de crear o cambiar `.env`: `npx expo start -c`.

Lleva una lista de cada error de IA que detectes o corrijas (tabla "Errores de IA" de la guía); se usa en el AI-LOG (Fase 11). **No inventar errores que no ocurrieron.**

---

## 2. Plan de migraciones locales

| Migración | Fase | Contenido |
|---|---|---|
| `0003_*` | Fase 4 (T4) | `photos`: `client_id` (único), `updated_at`, `remote_path`, `synced_at` |
| `0004_*` | Fase 9 (C5) | `owner_id` en `photos` y `albums`; el nombre de álbum pasa a ser único **por dueño** |

---

# TALLER EN CLASE (T1–T6)

## FASE 1 — Cliente y credenciales (T1)

```bash
git checkout -b semana-8-supabase
npx expo install @supabase/supabase-js expo-secure-store expo-crypto
```

1. **Primero** agregar a `.gitignore`:
   ```
   # Credenciales: NUNCA van a GitHub. Se versiona .env.example, no .env
   .env
   .env.*
   !.env.example
   ```
2. Crear `.env.example` (versionado):
   ```
   # Copia este archivo como .env con los valores de Project Settings > API Keys.
   # Solo la URL y la publishable key. La secret key NUNCA va en la app.
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   ```
3. Crear `.env` con los mismos nombres y **dejar los valores de ejemplo**. Yo pego los reales.
4. Correr `git status` y confirmar que `.env` **no** aparece.
5. `lib/secureStorage.ts` y `lib/supabase.ts` copiados de la guía (pasos 4 y 5): adaptador por fragmentos, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`, `startAutoRefresh/stopAutoRefresh` según `AppState`, y error claro si faltan las variables.

🛑 **Yo:** pego URL y publishable key reales en `.env`. En Supabase → Authentication → Sign In / Providers → Email, desactivo "Confirm email" (proyecto de práctica).

✅ Commit: `chore(supabase): cliente, sesión en SecureStore por fragmentos y variables de entorno`

---

## FASE 2 — Autenticación y rutas protegidas (T2)

1. `context/AuthContext.tsx` igual al de la guía (`session`, `isLoading`, `signIn`, `signUp`, `signOut`; los métodos devuelven el mensaje de error o `null`; `onAuthStateChange` con `unsubscribe` en la limpieza). Exponer también `userId: string | null` (= `session?.user.id ?? null`).
2. `app/login.tsx` con `StyleSheet` y `colors` del tema oscuro: título "GeoCam", correo, contraseña (`secureTextEntry`), validación (correo no vacío, contraseña de 6 o más caracteres), mensaje de error visible, botones "Iniciar sesión" y "Crear cuenta", ambos desactivados mientras `busy`. `KeyboardAvoidingView`.
3. `app/_layout.tsx`: mantener las pantallas de carga y error de migraciones de la Semana 7 y luego:
   ```tsx
   <AuthProvider><RootNavigator /></AuthProvider>
   ```
   `RootNavigator`: mientras `isLoading` → `<View style={{ flex: 1, backgroundColor: colors.background }} />`. Después:
   ```tsx
   <Stack screenOptions={{ headerShown: false }}>
     <Stack.Protected guard={!!session}>
       <Stack.Screen name="(tabs)" />
       <Stack.Screen name="foto/[id]" options={{ headerShown: true, title: 'Foto' }} />
     </Stack.Protected>
     <Stack.Protected guard={!session}>
       <Stack.Screen name="login" />
     </Stack.Protected>
   </Stack>
   ```
   Revisar cómo `app/foto/[id].tsx` configura hoy su header y respetarlo.
4. `app/index.tsx` → `<Redirect href={session ? '/geocam' : '/login'} />` (usa `useAuth`).
5. **Cerrar sesión:** botón "Cerrar sesión (correo)" en la cabecera de la pestaña **Fotos**, con `Alert` de confirmación. Sin `router.replace`.

🛑 **Yo:** creo una cuenta, cierro Expo Go por completo, lo vuelvo a abrir (la sesión debe seguir iniciada) y cierro sesión (debe volver al login solo).

✅ Commit: `feat(auth): registro, inicio y cierre de sesión con rutas protegidas`

---

## FASE 3 — Backend remoto (T3)

Crear `supabase/schema.sql` (versionado) con **el SQL de la guía MÁS lo que hace falta para el trabajo de casa**. Debe quedar así, completo:

```sql
-- ===== Tabla remota de fotos =====
create table public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null unique,          -- UUID creado en el teléfono: identifica la misma foto en ambos lados
  storage_path text not null unique,
  latitude double precision,
  longitude double precision,
  note text,
  favorite boolean not null default false,
  source text not null check (source in ('camera', 'gallery')),
  taken_at timestamptz not null,
  updated_at timestamptz not null,         -- última modificación hecha por el usuario
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "ver las mías" on public.photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear las mías" on public.photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "borrar las mías" on public.photos
  for delete to authenticated using ((select auth.uid()) = user_id);
-- (casa C1/C2) upsert de una foto editada después de subirla
create policy "actualizar las mías" on public.photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- (casa C4) cambios en vivo para la pestaña Nube
alter publication supabase_realtime add table public.photos;

-- ===== Bucket privado: las fotos con ubicación son datos personales =====
insert into storage.buckets (id, name, public) values ('geocam', 'geocam', false);

create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "leer mi carpeta" on storage.objects
  for select to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- (casa C2) reemplazar un archivo con upsert necesita INSERT + SELECT + UPDATE
create policy "reemplazar en mi carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
```

🛑 **Yo:** pego y ejecuto este SQL en el SQL Editor de **nuestro** proyecto de Supabase.

✅ Commit: `feat(supabase): esquema remoto con RLS y bucket privado geocam`

---

## FASE 4 — Nueva migración local (T4)

1. En `db/schema.ts`, dentro de `photos` (todas opcionales; SQLite no permite agregar una columna obligatoria sin valor constante a una tabla con filas):
   ```ts
   import * as Crypto from 'expo-crypto';
   // Identidad compartida con la nube: el id autoincremental solo vale en este teléfono
   clientId: text('client_id').unique().$defaultFn(() => Crypto.randomUUID()),
   // Última modificación hecha por el usuario
   updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
   // Ruta del archivo en el bucket y momento de la última sincronización
   remotePath: text('remote_path'),
   syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
   ```
2. `npm run db:generate` → `drizzle/0003_*.sql`. **Leerlo** y explicarme qué hizo (SQLite no admite `ADD COLUMN ... UNIQUE`, así que esperamos `ADD` + `CREATE UNIQUE INDEX`; si recrea la tabla, confirmar que copia los datos). No editarlo.
3. `db/repositories/photos.ts`, métodos nuevos:
   - `ensureSyncFields()`: llena `clientId` (`Crypto.randomUUID()`) y `updatedAt ?? createdAt` en filas con `clientId` nulo.
   - `update(id, data)` ahora **también escribe `updatedAt: new Date()`**. Una foto editada vuelve a quedar pendiente.
   - `markSynced(id, remotePath)`: escribe **solo** `remotePath` y `syncedAt: new Date()`. **No toca `updatedAt`**.
4. Llamar a `ensureSyncFields()` **una sola vez** al arrancar, después de que `useMigrations` termine con éxito (por ejemplo un `useEffect` en el layout raíz, o el hook `useSyncBootstrap`). Que no bloquee la UI.
5. Ampliar `GeoPhoto` (`types/geo.ts`) y `toGeoPhoto` con `clientId`, `remotePath`, `syncedAt: number | null`, `updatedAt: number | null` e `isSynced: boolean`. `isSynced` = `syncedAt !== null && (updatedAt === null || syncedAt >= updatedAt)`.

🛑 **Yo:** recargo en el teléfono que ya tiene fotos → siguen ahí (migración sin pérdida).

✅ Commit: `feat(db): migración 0003 con clientId, updatedAt, remotePath y syncedAt`

---

## FASE 5 — Subida de una foto (T5) y verificación (T6)

1. `services/cloudPhotos.ts`: única capa que conoce el bucket y la tabla remota. Base de la guía:
   - `uploadPhoto(photo, userId)`: valida `clientId`. Lee el archivo como `ArrayBuffer`. Lo sube a `${userId}/${clientId}.jpg` con `contentType` según la extensión. Inserta la fila (`client_id`, `storage_path`, `latitude`, `longitude`, `note`, `favorite`, `source`, `taken_at`, `updated_at` en ISO; **no envía `user_id`**). Termina con `photosRepo.markSynced(photo.id, path)`.
   - `signedUrl(path)` con `createSignedUrl(path, 3600)`.
   - Si el archivo local no existe (fotos viejas guardadas antes de la C5 de la Semana 7), lanzar "El archivo de esta foto ya no existe en el teléfono".
2. Hook `hooks/useCloudSync.ts` (las pantallas usan esto, no el servicio): `uploadOne(id)` y `isUploading`. Toma `userId` de `useAuth`.
3. `app/foto/[id].tsx`: botón **"☁️ Subir a la nube"**. Se desactiva si ya está sincronizada y muestra "Sincronizada" con la fecha. Los errores se muestran en `Alert`.
4. Ícono ☁️ en las miniaturas de fotos sincronizadas (pestaña Fotos y lista "Sin ubicación" del Mapa). Pendiente con cambios = "☁️•" o similar.

🛑 **Yo (T6):** subo una foto y la busco en Supabase → Storage → `geocam/<mi user id>/`. Reviso que no pese 0 bytes y que la fila esté en Table Editor → `photos`. Cierro la app y la sesión sigue.

✅ Commit: `feat: subir fotos a Supabase Storage (taller en clase)` → **entregable del taller**

---

# TRABAJO PARA LA CASA (C1–C7)

## FASE 6 — Subida idempotente sin huérfanos (C2) + pendientes (C1)

**C2: reescribir `uploadPhoto` para que repetirla nunca duplique:**
1. Si la foto **no tiene `remotePath`**, subir el archivo con `upsert: true` a `${userId}/${clientId}.jpg`. La ruta es determinística, así que repetir reemplaza y no duplica. Si ya tiene `remotePath`, solo cambió la metadata y **no se vuelve a subir el archivo**.
2. Fila: `upsert({...}, { onConflict: 'client_id' })` en vez de `insert`.
3. **Si el archivo se subió en este intento y la fila falla** → `storage.from('geocam').remove([path])` y luego relanzar el error original. Así no quedan huérfanos.
4. `markSynced` solo al final, cuando todo salió bien.

**C1: sincronizar pendientes**
1. `photosRepo.pendingForUpload()`: `syncedAt IS NULL OR syncedAt < updatedAt` (en la Fase 9 se filtra también por `ownerId`). Ordenar por `createdAt` ascendente.
2. En `useCloudSync`: `syncPending()` sube **una por una** (secuencial, no `Promise.all`) y expone `progress: { done, total } | null`. Si una falla, la guarda en una lista de errores y **sigue con las demás**. Al final devuelve `{ ok, failed, errors }`.
3. Exponer también `pendingCount` reactivo, con un `useLiveQuery` de un `count` en el repositorio.
4. UI en la pestaña **Fotos**: botón **"Sincronizar (N)"** que muestra "Subiendo 3 de 7…" mientras corre. Al terminar, `Alert`: "Se subieron X. Quedaron Y pendientes" y el primer error. Desactivado si N = 0 o si ya está corriendo.

🛑 **Yo:** creo 3 fotos, toco Sincronizar, vuelvo a tocar (0 pendientes, sin filas ni archivos repetidos en el panel). Edito la nota de una foto subida → vuelve a pendiente → sincronizo → la nota cambia en la nube.

✅ Commit: `feat(sync): sincronizar pendientes con progreso, upsert por client_id y sin archivos huérfanos`

---

## FASE 7 — Borrado coherente (C3)

1. `npx expo install expo-network`. Revisar la documentación de SDK 57 (`getNetworkStateAsync`: `isConnected` / `isInternetReachable`).
2. `cloudPhotos.deleteRemote(photo)`: borrar la **fila** por `client_id` y luego el **archivo** por `remotePath`. Si falla la fila, no se toca el archivo.
3. Unificar el borrado en `removePhotoById` (que ya usan `usePhotos` y `usePhoto`):
   - Si la foto **no** tiene `remotePath` → borrado local como hoy.
   - Si **sí** tiene: primero comprobar la red. Sin conexión → lanzar `"Sin conexión: la foto está en la nube y no se borró. Inténtalo con internet."` y **no borrar nada**. Con conexión → `deleteRemote` → si sale bien, registro local → archivo local. Si falla la parte remota, **no se toca lo local**.
4. `clearAll` (shake): aplicar la misma regla. Las fotos sincronizadas solo se borran con conexión. Sin conexión se cancela todo con un aviso. **Nunca a medias.**
5. Las pantallas (`foto/[id]`, Mapa, shake) muestran el error en `Alert`.

🛑 **Yo:** borro una foto sincronizada y desaparece del panel (fila y archivo). En modo avión intento borrar otra → aviso, y sigue en el teléfono y en la nube.

✅ Commit: `feat(sync): borrado coherente local + fila remota + archivo, sin borrar a medias sin conexión`

---

## FASE 8 — Pestaña Nube (C4)

1. `cloudPhotos.listRemote()`: `select('*').order('taken_at', { ascending: false })` (RLS ya filtra por usuario) y luego URLs firmadas en lote con `createSignedUrls(paths, 3600)`.
2. `hooks/useCloudPhotos.ts`: `photos`, `isLoading`, `error`, `reload`. Canal Realtime `geocam-photos-${userId}` con `postgres_changes` (`event: '*'`, `table: 'photos'`, `filter: user_id=eq.${userId}`) que llama a `reload`. **`removeChannel` en la limpieza.** Depende de `userId`, así que al cambiar de cuenta se re-suscribe.
3. `app/(tabs)/nube.tsx` (ícono ☁️) registrada en `(tabs)/_layout.tsx`: `FlatList` en grilla con imagen (URL firmada), fecha `toLocaleString('es-CO')`, ★, nota, 📍 y estado vacío "Aún no tienes fotos en la nube". `refreshing`/`onRefresh`. Muestra el error si no hay conexión.
4. Debe funcionar al iniciar sesión **en otro teléfono** sin fotos locales. Solo lee de la nube; la descarga a SQLite es de la Semana 9.

🛑 **Yo:** con dos teléfonos (o Expo Go + emulador) y la misma cuenta, subo en uno y aparece solo en la pestaña Nube del otro.

✅ Commit: `feat(nube): pestaña Nube con URLs firmadas y tiempo real`

---

## FASE 9 — Datos locales separados por usuario (C5)

1. `db/schema.ts`: `ownerId: text('owner_id')` (opcional) en `photos` **y** en `albums`. En `albums` cambiar `name.unique()` por un índice único compuesto `(owner_id, name)` (dos usuarios pueden tener un álbum con el mismo nombre). `npm run db:generate` → `0004_*.sql`. Leerlo y explicarlo; no editarlo.
2. **Filas antiguas sin dueño:** `photosRepo.claimOrphans(userId)` y `albumsRepo.claimOrphans(userId)` asignan `ownerId` a las filas con `owner_id IS NULL`. Se ejecutan al iniciar sesión, **una sola vez por teléfono**. Usar una marca en SecureStore (`geocam.orphansClaimed`) para que el primer usuario que entra se quede con las fotos anteriores y el segundo no se las lleve. Documentar esta decisión en el README.
3. **Todas** las consultas reciben `ownerId` y filtran por él: `listQuery`, `withLocationQuery`, `filteredQuery`, `detailQuery`, `allUris`, `pendingForUpload`, el conteo de pendientes, `clearAll` y la lista de álbumes. `findById`, `update`, `remove` y `markSynced` también filtran por dueño (`and(eq(id), eq(ownerId))`).
4. `create` de fotos y álbumes escribe `ownerId` = usuario de la sesión.
5. Los hooks toman `userId` de `useAuth()` y lo agregan a las dependencias de `useLiveQuery`. Las pantallas no cambian, salvo lo que haga falta para tipos.
6. Cerrar sesión **no borra** los datos locales, solo los oculta. Los ve de nuevo el mismo usuario al volver.

🛑 **Yo:** con la cuenta A tengo fotos y álbumes. Cierro sesión y entro con la cuenta B → GeoCam, Mapa, Fotos, Nube y Sincronizar están vacíos. Vuelvo a A → todo sigue ahí.

✅ Commit: `feat(db): migración 0004 con ownerId y consultas locales filtradas por usuario`

---

## FASE 10 — Auditoría de credenciales (C6)

Ejecutar y pegar las salidas reales en el README (sección "Auditoría de credenciales"):
```bash
git log --all --full-history -- .env          # debe salir vacío
git ls-files | grep -E "^\.env"               # solo .env.example
git check-ignore -v .env                      # muestra la regla de .gitignore
git grep -nE "sb_secret_|service_role|SERVICE_ROLE" -- . ':!docs/SEMANA8.md'   # sin resultados
git log --all -p | grep -nE "sb_secret_|service_role" | head   # sin resultados
```
Si **cualquiera** encuentra algo: DETENTE y avísame (hay que rotar la llave en Supabase y avisar al docente). No intentar "arreglar" el historial por tu cuenta.

✅ Commit: `docs: auditoría de credenciales`

---

## FASE 11 — Documentación (C7)

1. Mover el AI-LOG actual (Semana 7) a `docs/ai-log/AI-LOG-semana-7.md`.
2. Nuevo `AI-LOG.md` en la raíz con el formato de la guía:
   ```
   # Registro de Auditoría de IA (AI-LOG)
   **Estudiante(s):** Luis Nuñez, Amand Herrera
   **Semana:** 8
   **Proyecto:** GeoCam en la nube – Taller Integrador 2
   **Herramienta:** Claude Code
   ## 1. Prompts Utilizados
   ## 2. Código Generado vs. Código Modificado
   ## 3. Alucinaciones o Errores Detectados
   ```
   Contenido real de esta sesión: login con StyleSheet en vez de NativeWind, políticas UPDATE agregadas para el upsert, el orden archivo → fila con borrado compensatorio, el borrado remoto antes del local, `markSynced` sin tocar `updatedAt`, `claimOrphans` y los errores de la lista de la sección 1 que hayan aparecido.
3. `README.md`, sección **"Semana 8 – GeoCam en la nube"**:
   - Diagrama Mermaid de **las dos bases**: SQLite local (`albums`, `photos` con las columnas nuevas) y PostgreSQL remoto (`auth.users`, `public.photos`, bucket `geocam`), con la relación `client_id ↔ client_id` y `remote_path ↔ storage_path`.
   - Flujo de sincronización (pendiente → subir archivo → upsert fila → `markSynced`; si falla la fila → borrar archivo).
   - Regla de borrado y comportamiento sin conexión.
   - SQL completo: enlace a `supabase/schema.sql` y copia en un bloque.
   - Cómo configurar: copiar `.env.example` a `.env`, ejecutar el SQL y desactivar la confirmación por correo (solo en práctica).
   - Auditoría de credenciales (Fase 10).
   - Respuestas breves a las 4 "Preguntas para sustentar" de la guía.
   - GIF: `![Flujo Semana 8](docs/screenshots/flujo-semana8.gif)`. **El GIF lo grabamos nosotros.**

✅ Commit: `docs: README con diagrama de las dos bases, SQL y AI-LOG semana 8`

---

## Checklist final (verificar uno por uno antes de entregar)

- [ ] Registro, inicio y cierre de sesión funcionan y muestran los errores.
- [ ] Sin sesión no se entra a ninguna pantalla privada (tabs, `foto/[id]`).
- [ ] La sesión sigue al cerrar la app por completo; se guarda en SecureStore, no en AsyncStorage.
- [ ] RLS activo en la tabla y el bucket: con una segunda cuenta no se ven ni se borran fotos ajenas.
- [ ] Las fotos subidas no pesan 0 bytes y están en `geocam/<user id>/`.
- [ ] Sincronizar dos veces no duplica filas ni archivos; no hay archivos huérfanos.
- [ ] Borrar una foto sincronizada la borra de las tres partes; sin conexión no se borra nada.
- [ ] La pestaña Nube funciona en otro teléfono y se actualiza en vivo.
- [ ] Otra cuenta en el mismo teléfono no ve los datos locales de la anterior.
- [ ] `.env` en `.gitignore`, existe `.env.example`, no hay secret key en el código ni en el historial.
- [ ] `drizzle/` versionada con `0003` y `0004`.
- [ ] `README.md` y `AI-LOG.md` en la raíz; `supabase/schema.sql` versionado.
- [ ] `npx tsc --noEmit`, `npx expo lint` y `npx expo-doctor` sin errores.
- [ ] Push de la rama, merge a `main` y enlace del repo entregado **antes del miércoles 21 de octubre, 00:00**.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` llega `undefined` | No reiniciaste con `npx expo start -c`, o el archivo no se llama exactamente `.env` |
| "new row violates row-level security policy" al subir | La ruta no empieza por el id del usuario o falta la política de insert del bucket |
| Upsert del archivo falla por RLS | Faltan las políticas SELECT/UPDATE de `storage.objects` (Fase 3) |
| La consulta devuelve una lista vacía sin error | Falta la política de select o no hay sesión |
| Archivo de 0 bytes | Se usó `Blob`/`FormData`; debe ser `ArrayBuffer` |
| "duplicate key" / "The resource already exists" | Se usó `insert` sin `upsert`; revisar la Fase 6 |
| "table photos already exists" | Se regeneró la migración sin la carpeta `drizzle/` original |
| La pestaña Nube no se actualiza sola | Falta `alter publication supabase_realtime add table public.photos` |
| Advertencia de SecureStore por tamaño | Se usó `SecureStore` directo; usar el adaptador por fragmentos |
