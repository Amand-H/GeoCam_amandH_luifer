# Instrucciones para Claude Code — Semana 9: TanStack Query y sincronización offline-first

> ⚠️ **El proyecto está en SDK 58; usar `https://docs.expo.dev/versions/v58.0.0/`** (React Native 0.88 con la API de tipos estricta). Donde este archivo diga SDK 57 o `v57.0.0`, leer SDK 58. Ver `docs/UPGRADE-SDK58.md`.

> **Cómo usar este archivo:** guárdalo en el repo como `docs/SEMANA9.md`, descomprime el zip `s9-geocam-sync.zip` en `C:\Users\amand\OneDrive\Escritorio\AMAND_PRACTICA\referencia-s9\` (FUERA del repo) y en Claude Code pega:
>
> ```
> Lee docs/SEMANA9.md completo, AGENTS.md, docs/SEMANA8.md y el README de ../referencia-s9/geocam-sync.
> Ejecuta las fases en orden, una a la vez. Al terminar cada fase: corre `npx tsc --noEmit` y `npx expo lint`,
> restaura tsconfig.json si Expo lo reescribió, haz el commit indicado y DETENTE en cada 🛑.
> Solo el remoto `mio`, nunca `origin`. Responde siempre en español.
> ```

---

## 0. Estado real del repositorio (léelo antes de tocar código)

Repo: `https://github.com/Amand-H/GeoCam_amandH_luifer` (remoto **`mio`**). `main` termina en la Semana 8 (`af6c52d`).

| Ya existe (Semana 8) | Archivo |
|---|---|
| Login, sesión en SecureStore, `Stack.Protected` | `context/AuthContext.tsx`, `lib/secureStorage.ts`, `lib/supabase.ts`, `app/_layout.tsx` |
| Columnas locales `clientId`, `updatedAt`, `remotePath`, `syncedAt`, `ownerId` | `db/schema.ts`, migraciones `0000`–`0004` |
| `photosRepo.update` escribe `updatedAt`; `markSynced` | `db/repositories/photos.ts` |
| Subida manual idempotente (upsert por `client_id`), botón **Sincronizar (N)** | `services/cloudPhotos.ts`, `hooks/useCloudSync.ts` |
| Borrado **físico** coherente (fila + archivo remoto + local), bloqueado sin red | `services/cloudPhotos.ts` (`deleteRemote`), `hooks/usePhotos.ts` (`removePhotoById`) |
| Pestaña **Nube** (lista + URL firmada + realtime) | `app/(tabs)/nube.tsx`, `hooks/useCloudPhotos.ts` |
| Red | `services/network.ts` (expo-network) |
| Fotos huérfanas sin dueño | `services/orphans.ts` |

**En Supabase (proyecto `geocam`, ref `yvtlggqctkaovaqxstdi`) YA existen:** tabla `photos` con RLS, la política **`"actualizar las mías"` (UPDATE)**, bucket privado `geocam` con 4 políticas, y `photos` en `supabase_realtime`. → **No crear la política `"editar las mías"` del T1: sería duplicada.**

**Referencia:** `../referencia-s9/geocam-sync` es la solución del profesor para el taller (T1–T6). Úsala como guía de código, **adaptándola** a este repo (aquí hay `ownerId`, `StyleSheet` en vez de NativeWind, y otra base local). **No copies** su `package.json`, `babel.config.js`, NativeWind ni su base `geocam-sync.db`.

**Reglas de siempre:** `npx expo install` para paquetes de Expo; leer la doc de SDK 57 (`https://docs.expo.dev/versions/v57.0.0/`) antes de usar APIs de Expo; migraciones solo con `npm run db:generate` (nunca editar `.sql` ni `migrations.js`, nunca `push`); las pantallas no importan Supabase ni Drizzle; nada de secret keys.

---

## 1. Diseño (no negociable)

1. **SQLite es la fuente de verdad.** La UI lee y escribe local, con o sin red. Nunca espera a la nube.
2. **Identidad compartida:** `clientId` (UUID). El `id` autoincremental solo vale en un teléfono.
3. **Pendiente** = `syncedAt` nulo **o** `updatedAt > syncedAt` (+ filtrado por `ownerId` del usuario de la sesión).
4. **Cursor de bajada** por usuario en la tabla local `sync_meta` (`lastPulledAt:<userId>`), basado en **`server_updated_at`** (reloj del servidor), nunca en `updated_at`.
5. **Conflicto: gana el último cambio** (`updatedAt` más reciente). `remoteWins()` es una **función pura** en `services/sync.ts`.
6. **Orden del ciclo: primero BAJAR, después SUBIR.**
7. `markSynced(id, path, updatedAtSubido)` → `syncedAt` = la versión subida, **nunca `new Date()`**. `applyRemote` tampoco usa la hora actual. Solo `photosRepo.update` (la UI) escribe `updatedAt: new Date()`.
8. **TanStack Query v5** solo ejecuta, reintenta y dispara la sincronización. La lógica es nuestra.

### Errores de IA a evitar (anota en el AI-LOG los que aparezcan de verdad)

| Mal | Bien |
|---|---|
| `useQuery(['sync'], fn)`, `cacheTime`, `status === 'loading'`, `onSuccess` dentro de `useQuery` | Forma con objeto, `gcTime`, `'pending'`, efectos en `useMutation`/`useEffect` |
| `useInfiniteQuery` sin `initialPageParam` | Declararlo y tiparlo |
| Paginación con `range()` | Cursor (`lt('taken_at', cursor)`) |
| `window.addEventListener('online')` | `onlineManager.setEventListener` con `expo-network` |
| Subir primero y bajar después | Bajar, comparar, subir |
| `insert` al reintentar | `upsert` con `onConflict: 'client_id'` |
| `syncedAt: new Date()` | `syncedAt` = `updatedAt` subido |
| Cursor con `updated_at` | Cursor con `server_updated_at` |
| `DELETE` directo | Borrado lógico con `deletedAt` |
| `fetch` en `useEffect` "porque es más simple" | `useQuery` |

---

## 2. Plan de migraciones

| Dónde | Archivo | Contenido | Fase |
|---|---|---|---|
| Supabase | `supabase/semana9.sql` | `server_updated_at` + trigger + índice (**sin** política nueva) | 1 |
| SQLite | `drizzle/0005_*` | tabla `sync_meta` | 3 |
| Supabase | `supabase/semana9-borrados.sql` | `deleted_at` en `photos` | 7 |
| SQLite | `drizzle/0006_*` | `deletedAt` en `photos` | 7 |

---

# TALLER EN CLASE (T1–T7)

## FASE 1 — Backend (T1)

```bash
git checkout main && git pull mio main
git checkout -b semana-9-sync
```

Crear `supabase/semana9.sql`:
```sql
-- GeoCam · Semana 9 (T1). Ejecutar DESPUÉS de schema.sql (Semana 8).
-- Reloj del servidor: cuándo llegó cada cambio a Supabase (cursor de bajada)
alter table public.photos
  add column server_updated_at timestamptz not null default now();

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

create trigger photos_touch_server_updated_at
  before insert or update on public.photos
  for each row execute function public.touch_server_updated_at();

create index photos_user_server_updated_idx
  on public.photos (user_id, server_updated_at);

-- La política UPDATE que pide la guía ("editar las mías") YA existe desde la
-- Semana 8 con el nombre "actualizar las mías" (ver schema.sql). No se duplica.
```

🛑 **Yo (ING):** le pido a Claude (chat) que ejecute este SQL en el proyecto `geocam`. **No lo ejecutes tú.**

✅ Commit: `feat(supabase): server_updated_at con trigger para el cursor de bajada (Semana 9 T1)`

---

## FASE 2 — TanStack Query (T2)

```bash
npx expo install @tanstack/react-query expo-network
```
(`expo-network` puede estar ya; no importa.)

1. `lib/queryClient.ts` igual al de la referencia: `QueryClient` (`staleTime: 30_000`, `retry: 2`), `onlineManager.setEventListener` con `expo-network`, `useAppFocusManager()` con `AppState`, `useIsOnline()` con `useSyncExternalStore`.
2. Revisar `services/network.ts` (Semana 8): si duplica la lógica, que use `onlineManager`/`useIsOnline` o déjalo solo para la comprobación puntual del borrado. No dejes dos fuentes de verdad de "hay red" que puedan contradecirse.
3. `app/_layout.tsx`: `useAppFocusManager()` y envolver con `<QueryClientProvider client={queryClient}>` **por fuera** de `AuthProvider`, sin tocar las pantallas de carga/error de migraciones ni `Stack.Protected`.

✅ Commit: `feat(query): TanStack Query con onlineManager y focusManager (T2)`

---

## FASE 3 — Soporte local (T3)

1. `db/schema.ts`: tabla `syncMeta` (`key` text PK, `value` text not null). `npm run db:generate` → `drizzle/0005_*.sql`. Leerlo y explicarlo (debe ser solo `CREATE TABLE`). No editarlo.
2. `db/repositories/syncMeta.ts` con `get(key)` y `set(key, value)` (upsert con `onConflictDoUpdate`).
3. `db/repositories/photos.ts` — agregar/ajustar (todos filtrando por `ownerId`):
   - `pendingQuery(ownerId)` (sin ejecutar, para `useLiveQuery`) y `listPending(ownerId)`. Si ya existe algo equivalente de la Semana 8, **reutilízalo** y no lo dupliques.
   - `findByClientId(clientId, ownerId)`.
   - `insertFromRemote(data)` → guarda también **`ownerId`**.
   - `applyRemote(id, { note, favorite, updatedAt, syncedAt })` → nunca hora actual.
   - `markSynced(id, remotePath, syncedAt)` → recibe la versión subida. Ajusta todos los llamadores de la Semana 8.
4. `services/photoFiles.ts`: `downloadPhotoFile(storagePath, clientId)` → descarga a `Paths.document/photos/<clientId>.jpg` con URL firmada (`File.downloadFileAsync`, API nueva de SDK 57; verifica en la doc). Si ya existe el archivo, devuelve su URI.

🛑 **Yo:** recargo la app (`r`) → las fotos siguen ahí (migración 0005 sin pérdida).

✅ Commit: `feat(db): migración 0005 sync_meta y métodos de sincronización en el repositorio (T3)`

---

## FASE 4 — Bajar y subir (T4 + T5)

`services/sync.ts` (base: la referencia, adaptada):
- `remoteWins(localUpdatedAt, remoteUpdatedAt)` y `isPending(photo)` como funciones puras exportadas.
- `pull(userId)`: `select * where server_updated_at > cursor order by server_updated_at limit 200`. Por fila: no existe → `downloadPhotoFile` + `insertFromRemote` (con `ownerId = userId`, nace sincronizada); remota más nueva → `applyRemote`; local más nueva → no tocar. **El cursor avanza fila por fila.**
- `push(userId)`: unifica con la subida de la Semana 8 (no dejes dos implementaciones). Archivo solo si no hay `remotePath` (tolerar "already exists"), `upsert` por `client_id`, `markSynced` con el `updatedAt` subido. **Fotos sin archivo local** (las viejas de antes de la C5 de la Semana 7): se saltan y se cuentan como `sinArchivo`, como ya hacía el commit `2346a3f`.
- **C5 (adelantado aquí): errores por foto.** Si una foto falla, se registra el error y **se sigue con las demás**; queda pendiente para el próximo ciclo.
- `syncAll(userId)`: bajar → subir, máx. 3 vueltas si hubo ediciones, **un solo ciclo a la vez** (reutiliza la promesa en curso). Devuelve `{ pulled, pushed, failed, sinArchivo, errors, finishedAt }`.
- Retirar `services/cloudPhotos.ts` → que quede solo lo que `sync.ts` use (bucket, `signedUrl`, etc.). `hooks/useCloudSync.ts` se reemplaza en la Fase 5.

✅ Commit: `feat(sync): pull y push en dos sentidos con cursor y gana el último cambio (T4, T5)`

---

## FASE 5 — Disparo automático y estado (T6)

1. `hooks/useSync.ts` como la referencia: `useQuery({ queryKey: ['sync', userId], queryFn: () => syncAll(userId!), enabled: !!userId, staleTime: 0, retry: 2, refetchOnReconnect: 'always', refetchOnWindowFocus: 'always' })` + `pendingCount` con `useLiveQuery(photosRepo.pendingQuery(userId))` (dependencia `userId`). Exporta `requestSync()` = `queryClient.invalidateQueries({ queryKey: ['sync'] })`.
2. Llamar `requestSync()` después de **cada cambio local**: foto nueva, nota, favorita, álbum.
3. Indicador (`components/SyncBadge.tsx` o uno nuevo `SyncStatus`) en **GeoCam** y **Fotos**: `Sin conexión · N pendientes` / `Sincronizando…` / `N pendientes` / `Al día`. Al tocarlo → `syncNow()`.
4. El botón **Sincronizar (N)** de la Semana 8 desaparece o pasa a ser ese indicador. **No quedan dos mecanismos de subida.**
5. Eliminar `hooks/useCloudSync.ts` si ya nadie lo usa.

🛑 **Yo (T7, 3 pruebas):**
1. **Sin conexión:** modo avión, 2 fotos + editar 1 nota → indicador muestra pendientes. Quito modo avión → se suben solas → "Al día".
2. **Dos teléfonos:** misma cuenta en el teléfono de mi pareja → las fotos aparecen con imagen y en el mapa.
3. **Conflicto:** ambos en modo avión, edito la nota de la misma foto en A y 1 min después en B → reconecto ambos → en los dos queda la de B.

✅ Commit: `feat(sync): sincronización automática con TanStack Query e indicador de estado (T6)` → **entregable del taller**. `git push -u mio semana-9-sync`.

---

# TRABAJO PARA LA CASA (C1–C7)

## FASE 6 — Pantalla de estado de sincronización (C4)

Ruta `app/sync.tsx` (Stack, header "Sincronización"), abierta al tocar el indicador:
- Fotos pendientes (lista corta con miniatura), fecha/hora de la última sincronización (`toLocaleString('es-CO')`), resultado (subieron / bajaron / fallaron / sin archivo), último error legible, botón **"Sincronizar ahora"** (desactivado sin red o mientras sincroniza).
- Datos del `useSync()`; la pantalla no importa Supabase ni Drizzle.

✅ Commit: `feat(sync): pantalla de estado de sincronización (C4, C5)`

---

## FASE 7 — Borrados sincronizados (C1)

1. Crear `supabase/semana9-borrados.sql`:
   ```sql
   -- Semana 9 · C1: borrado lógico. La fila queda como "lápida" para que los demás teléfonos se enteren.
   alter table public.photos add column deleted_at timestamptz;
   ```
   🛑 **Yo:** le pido a Claude (chat) que lo ejecute en `geocam`.
2. `db/schema.ts`: `deletedAt: integer('deleted_at', { mode: 'timestamp_ms' })` en `photos`. `npm run db:generate` → `0006_*` (debe ser `ALTER TABLE ... ADD`). No editarlo.
3. **Borrar = marcar:** `removePhotoById` pone `deletedAt` y `updatedAt` = ahora, y llama `requestSync()`. **Funciona sin conexión** (la regla de la Semana 8 "sin red no se borra" se reemplaza: anótalo en README y AI-LOG).
4. **Todas** las consultas de la UI (`listQuery`, `withLocationQuery`, `filteredQuery`, `detailQuery`, mapa, conteos) filtran `deletedAt IS NULL`. `pendingQuery` **sí** incluye las marcadas.
5. `push`: sube `deleted_at` en el upsert. Si la foto marcada **nunca se subió** (`remotePath` nulo) → se borra solo en local, sin tocar la nube. Cuando la marca quedó sincronizada → borra el archivo del bucket (`storage.remove`) y el archivo local y la fila local.
6. `pull`: si la remota trae `deleted_at` y gana → borra fila local + archivo local. Si no existe en local y viene borrada → no la descargues.
7. Shake → "borrar todo" usa el mismo borrado lógico.
8. Retirar `deleteRemote` físico de la Semana 8.

🛑 **Yo:** borro en A → desaparece en B y del bucket. Edito en A y borro en B (ambos sin red) → queda borrada en los dos.

✅ Commit: `feat(sync): borrado lógico sincronizado con deletedAt (C1)`

---

## FASE 8 — Feed de la nube con useInfiniteQuery (C2)

Reescribir la pestaña **Nube** (`hooks/useCloudPhotos.ts` + `app/(tabs)/nube.tsx`):
- Servicio `listRemotePage({ cursor, search })`: `photos` con `deleted_at is null`, `order('taken_at', desc)`, `limit(12)`, `lt('taken_at', cursor)` si hay cursor, `ilike('note', '%term%')` si hay búsqueda. Devuelve `{ items, nextCursor }`. URLs firmadas en lote (`createSignedUrls`).
- `useInfiniteQuery({ queryKey: ['nube', userId, { search }], initialPageParam: null as string | null, getNextPageParam: (p) => p.nextCursor, placeholderData: keepPreviousData })`.
- `hooks/useDebouncedValue.ts` (400 ms) para la búsqueda en vivo por nota.
- Realtime: el canal ya no recarga a mano → `invalidateQueries({ queryKey: ['nube'] })`; `removeChannel` en la limpieza.
- `FlatList`: `onEndReached` → `fetchNextPage()` si `hasNextPage && !isFetchingNextPage`; `refreshing`/`onRefresh`; footer con spinner.
- **4 estados de UI:** carga (`status==='pending' && fetchStatus==='fetching'`), sin conexión sin datos (`pending && paused`), error con **Reintentar**, vacío (distinto si hay búsqueda). Banner "Sin conexión. Se muestran los datos guardados." con `useIsOnline()`.

🛑 **Yo:** con más de 12 fotos subidas bajo la lista (pagina de a 12); busco por nota; modo avión → aviso y lista visible.

✅ Commit: `feat(nube): feed paginado por cursor con useInfiniteQuery, búsqueda y estados de UI (C2)`

---

## FASE 9 — Caché que sobrevive al cierre (C3)

```bash
npx expo install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
```
- Persistir la caché con `PersistQueryClientProvider` (reemplaza a `QueryClientProvider`) y `createAsyncStoragePersister` usando **`expo-sqlite/kv-store`** como storage (ya tenemos expo-sqlite; no agregues AsyncStorage). Verifica en la doc de SDK 57 que `expo-sqlite/kv-store` expone la API compatible.
- `gcTime` de las consultas de `['nube']` ≥ `maxAge` del persister (24 h).
- **No persistir la consulta `['sync']`** (`dehydrateOptions.shouldDehydrateQuery`).
- Las URLs firmadas vencen (1 h): si la imagen falla al cargar desde caché, mostrar un placeholder y refrescar al volver la red. Anótalo en el AI-LOG.

🛑 **Yo:** abro Nube con red, cierro la app, modo avión, abro → la pestaña Nube muestra los últimos datos.

✅ Commit: `feat(query): caché persistente de TanStack Query (C3)`

---

## FASE 10 — Matriz de pruebas y documentación (C6 + C7)

1. Mover el AI-LOG de la Semana 8 a `docs/ai-log/AI-LOG-semana-8.md`. Nuevo `AI-LOG.md` (Semana 9, Luis Nuñez y Amand Herrera, formato de la guía) con lo que **realmente** pasó: política UPDATE ya existente, unificación con la subida de la Semana 8, borrado ahora permitido sin red, URLs firmadas en caché, y los errores de IA de la tabla que hayan aparecido. **No inventar.**
2. `README.md`, sección **"Semana 9 – Sincronización offline-first"**:
   - Diagrama Mermaid del ciclo (bajar → comparar → subir; disparadores: sesión, red, primer plano, cambio local).
   - Las dos columnas de fecha (`updated_at` vs `server_updated_at`) y por qué hacen falta.
   - Regla de conflicto con un ejemplo concreto (nota "A" a las 10:00 vs "B" a las 10:01).
   - Borrado lógico.
   - **Matriz de pruebas** (los 7 escenarios de la guía) con columnas *Esperado* y *Obtenido* — deja *Obtenido* vacío para que yo lo llene.
   - Respuestas breves a las 5 "Preguntas para sustentar".
   - GIF `![Prueba sin conexión](docs/screenshots/flujo-semana9.gif)` — lo grabo yo.

✅ Commit: `docs: README con ciclo de sincronización, matriz de pruebas y AI-LOG semana 9`

🛑 **Yo:** hago la matriz con dos teléfonos y le paso a Claude (chat) los resultados y el video para el GIF.

---

## Checklist final

- [ ] Pestaña Nube: cursor, infinite scroll, búsqueda en vivo, 4 estados de UI.
- [ ] Totalmente usable en modo avión e informa cuántas fotos están pendientes.
- [ ] Al volver la red, sube solo; foto de otro teléfono aparece con imagen y ubicación.
- [ ] Repetir la sincronización no duplica filas ni archivos.
- [ ] Conflicto: gana el más reciente; los borrados llegan a los demás teléfonos.
- [ ] Lógica en `services/`, `remoteWins` pura; pantallas sin Supabase ni Drizzle.
- [ ] `drizzle/0005` y `0006` versionadas; `supabase/semana9.sql` y `semana9-borrados.sql` en el repo.
- [ ] README con matriz (resultados reales) y `AI-LOG.md` en la raíz; GIF.
- [ ] `.env` fuera del repo; `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` sin errores.
- [ ] Merge a `main` y `git push mio main`.
