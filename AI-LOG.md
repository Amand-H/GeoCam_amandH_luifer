# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 8
**Proyecto:** GeoCam en la nube – Taller Integrador 2
**Herramienta:** Claude Code

> Registros anteriores: [Semana 7](docs/ai-log/AI-LOG-semana-7.md) · [Semana 6](docs/ai-log/AI-LOG-semana-6.md).

## 1. Prompts Utilizados

- Se le entregó a Claude Code un archivo de instrucciones por fases (`docs/SEMANA8.md`) construido a partir de
  la guía de la Semana 8, con el estado real del repositorio (SDK 57, rutas en `app/`, sin NativeWind,
  `.env` todavía sin ignorar), las reglas obligatorias (capas, solo publishable key, SecureStore por
  fragmentos, `Stack.Protected`, `ArrayBuffer`, RLS siempre activo, `removeChannel`) y el plan de
  migraciones `0003`/`0004`. El prompt fue el que trae el propio archivo: *"Lee docs/SEMANA8.md completo,
  AGENTS.md y docs/SEMANA7.md. Ejecuta las fases en orden, una a la vez. Al terminar cada fase: corre
  `npx tsc --noEmit` y `npx expo lint`, haz el commit indicado y DETENTE en cada 🛑…"*.
- En los puntos 🛑 se respondió tras hacer la parte manual: pegar la URL y la publishable key en `.env` y
  desactivar "Confirm email"; probar registro, sesión persistente y cierre de sesión; ejecutar el SQL en el
  proyecto `geocam`; verificar que las fotos anteriores seguían tras la migración `0003`; subir una foto y
  comprobar en el panel que pesaba 1.442.220 bytes y que su fila tenía el mismo `client_id`.
- Se indicó una restricción adicional: *"Solo usa el remoto `mio`, nunca `origin`"* (todos los push fueron a
  `mio/semana-8-supabase`).
- Cuando Sincronizar falló con 3 fotos, se pidió **diagnosticar antes de cambiar código** (registrar uri,
  `File.exists` y ubicación de cada foto) y, según el resultado, corregir la lectura o tratar las fotos
  "sin archivo". Se pegó la salida real del log del teléfono.
- Por último se pidió continuar con las fases 7 a 11 sin detenerse en cada 🛑; las pruebas manuales de esas
  fases se hacen al final.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** toda la integración con Supabase, respetando las capas
  (pantalla → hook → servicio/repositorio → Supabase o Drizzle):
  - `lib/secureStorage.ts` y `lib/supabase.ts`; `context/AuthContext.tsx` y `app/login.tsx`;
    `Stack.Protected` en `app/_layout.tsx`.
  - `supabase/schema.sql` (copiado tal cual de la guía de instrucciones).
  - `services/cloudPhotos.ts` (único archivo que conoce el bucket y la tabla remota), `services/network.ts`,
    `services/orphans.ts`; hooks `useCloudSync`, `useCloudPhotos`, `useSyncBootstrap`, `useClaimOrphans`,
    `useOwnerId`; pestaña `app/(tabs)/nube.tsx` y componente `SyncBadge`.
  - Las migraciones `0003` y `0004` se generaron con `npm run db:generate`; ninguna se editó a mano.
- **¿Qué se modificó o se decidió distinto respecto al código base de la guía?:**
  - **Login con `StyleSheet` en vez de NativeWind:** el proyecto no usa NativeWind; se usaron `StyleSheet` y
    `constants/theme.ts` para no agregar una dependencia solo para una pantalla.
  - **Políticas `UPDATE` agregadas** en `public.photos` y en `storage.objects`: el `upsert` de la fila
    necesita `UPDATE` cuando la fila ya existe, y reemplazar un archivo con `upsert: true` necesita
    INSERT + SELECT + UPDATE en el bucket. La guía base solo tenía select/insert/delete.
  - **Orden archivo → fila con borrado compensatorio:** si la fila falla y el archivo se subió en ese mismo
    intento, se borra del bucket antes de relanzar el error, para no dejar archivos huérfanos.
  - **Borrado remoto antes que el local:** primero la fila remota, luego el archivo del bucket, luego el
    registro y el archivo locales. Sin conexión, o si falla la parte remota, no se borra nada local; si se
    borrara primero lo local, la foto quedaría en la nube sin nada en el teléfono que permita borrarla.
  - **`markSynced` no toca `updatedAt`:** si lo hiciera, `synced_at >= updated_at` dejaría de distinguir una
    foto editada de una al día.
  - **`claimOrphans`:** las filas sin dueño (anteriores a la `0004`) pasan al primer usuario que inicia
    sesión en el teléfono, una sola vez (marca `geocam.orphansClaimed` en SecureStore).
  - **Lectura del archivo con `File.arrayBuffer()`** (API nueva de `expo-file-system`) en vez de
    `fetch(uri).then(r => r.arrayBuffer())`. Sigue siendo `ArrayBuffer` (nunca `Blob` ni `FormData`), y
    además permite comprobar `File.exists` antes de leer (ver punto 3: `fetch` habría subido 14 bytes).
  - **Realtime con dos escuchas:** `event: '*'` filtrado por `user_id` y otra solo para `DELETE` sin filtro,
    porque Supabase no aplica filtros a los eventos `DELETE` (el registro borrado solo trae la llave
    primaria). La escucha no expone datos: solo dispara una recarga, y la recarga pasa por RLS.
  - **`allUris` devuelve también `clientId` y `remotePath`**, porque "borrar todo" necesita saber qué fotos
    están en la nube.

## 3. Alucinaciones o Errores Detectados

- **El `import * as Crypto from 'expo-crypto'` de la guía rompió `npm run db:generate` (Fase 4).** `drizzle-kit`
  ejecuta `db/schema.ts` en Node, donde el módulo nativo no carga: `Error: Cannot find module 'expo-modules-core'`.
  Se cambió por una función `newClientId()` que hace `require('expo-crypto')` solo al generar el valor (dentro
  de la app). Así el `$defaultFn` sigue cubriendo todos los inserts, incluido `db/devSeed.ts`.
- **Fotos pendientes "sin archivo" (Fase 6).** Al sincronizar, 3 fotos fallaban con *"El archivo de esta foto
  ya no existe en el teléfono"*, aunque en la pestaña Fotos parecían verse bien. **Antes de cambiar código** se
  agregó un diagnóstico en `__DEV__` (`diagnosePhotoFile`). La salida real en el teléfono (Android, Expo Go)
  para las fotos 1, 2 y 4 fue:
  - `uri` en la **caché** (`.../cache/ExperienceData/.../Camera/…jpg` y `.../ImagePicker/…jpeg`): fotos guardadas
    antes de la C5 de la Semana 7, cuando todavía no se copiaban a `Paths.document/photos`.
  - `new File(uri).exists` → `false`.
  - `fetch(uri).then(r => r.arrayBuffer())` → **14 bytes** (sin error). Una foto real pesa más de 1 MB
    (la del T6: 1.442.220 bytes).

  **Conclusión:** el sistema borró esos archivos de la caché. La lectura no estaba mal. Cambiar a `fetch`, como
  sugería la guía, habría sido un error: `fetch` no falla con un archivo inexistente y habría subido "fotos"
  corruptas de 14 bytes al bucket. Se mantuvo `File.exists` + `File.arrayBuffer()`. La imagen que se seguía
  viendo en la grilla probablemente era la caché de imágenes de Android, no el archivo; no se comprobó.

  **Corrección:** `canUpload()` = la foto ya tiene `remotePath` o su archivo existe. Las pendientes que no
  cumplen no se intentan subir, no cuentan en "Sincronizar (N)", el resumen dice cuántas quedaron "sin
  archivo" y el detalle muestra *"Sin archivo: no se puede subir"*. Una foto ya subida que perdió el archivo
  local sí puede actualizar su metadata (no necesita volver a subir el archivo). El conteo del botón pasó de
  un `COUNT` en SQL a filtrar en el hook las filas pendientes, porque SQLite no sabe si el archivo existe.
- **`npx expo start` volvió a reescribir `tsconfig.json`** (igual que en la Semana 7). Se restauró con
  `git checkout -- tsconfig.json`; ese cambio no entró en ningún commit.
- **Riesgo revisado en la migración `0004` (no fue error).** Cambiar el `UNIQUE` de `albums.name` podía hacer
  que `drizzle-kit` recreara la tabla `albums` (`DROP TABLE`), lo que con la llave foránea de `photos` habría
  fallado o desvinculado fotos. Se revisó primero la `0000`: el `UNIQUE` era un índice aparte, así que el SQL
  generado fue `DROP INDEX` + `ALTER TABLE … ADD owner_id` + `CREATE UNIQUE INDEX (owner_id, name)`, sin
  recrear tablas. Se comprobó aplicando `0000`–`0004` con `node:sqlite` y `PRAGMA foreign_keys = ON` sobre
  datos de prueba: las filas y el `album_id` se conservan, el mismo nombre de álbum se permite con otro dueño
  y se rechaza con el mismo dueño.
- **El quinto comando de la auditoría (Fase 10) se encuentra a sí mismo.** `git log --all -p | grep -nE
  "sb_secret_|service_role"` devolvió 3 líneas, todas del texto de `docs/SEMANA8.md` (que nombra esas
  palabras para prohibirlas y contiene los propios comandos). El cuarto comando excluye ese archivo, pero el
  quinto no puede. Se verificó que no son llaves buscando en todo el historial valores con forma de llave
  (`sb_secret_…`, `sb_publishable_…`, JWT `eyJ…`): solo aparece el marcador `sb_publishable_xxxxxxxx` de
  `.env.example`. No hubo que rotar llaves.

---

## Actualización a SDK 58

Expo Go del teléfono se actualizó y dejó de abrir proyectos SDK 57 (*"Project is incompatible with this version
of Expo Go"*). Se subió el proyecto **una sola vez sobre `main`**, en la rama `upgrade-sdk58`, siguiendo
`docs/UPGRADE-SDK58.md`. Claude Code leyó primero las fuentes oficiales (blog de actualización, changelog de
SDK 58 y la guía de Expo Router 57 → 58). El changelog es muy largo y no se leyó completo; lo que no se leyó
se tomó de un resumen.

**Versiones:** `expo` 57.0.30 → 58.0.23 · `react-native` 0.86.3 → 0.88.1 · `react`/`react-dom` 19.2.3 → 19.3.0 ·
`@types/react` 19.2 → 19.3 · `expo-router` 57.0.28 → 58.0.30 · `react-native-maps` 1.27.2 → 1.29.11 ·
`react-native-screens` 4.26 → 4.30.1 · `react-native-safe-area-context` 5.7 → 5.11.1 · todos los `expo-*` a 58.0.x.
`typescript` (6.0.3), `drizzle-orm`, `drizzle-kit` y `@supabase/supabase-js` quedaron igual. `npx expo-doctor`:
20/20 sin problemas.

Qué rompió y cómo se arregló (errores reales):

- **`npm install` falló con `ERESOLVE`.** `expo-router@58.0.30` declara `@expo/ui@^58.0.27` como dependencia
  *peer opcional* y npm no la resolvía. Se creó `.npmrc` con `legacy-peer-deps=true` (lo que indica la guía
  para este caso) y se repitió. `@expo/ui` no se instala: solo hace falta para `Stack.Toolbar` en Android.
- **`npx expo install expo@^58.0.0` dejó `"expo": "^58.0.0"`** en `package.json`, a diferencia del `~` que
  usan los demás paquetes de Expo. Se fijó en `~58.0.23` (la versión instalada).
- **Un error de tipos por la API estricta de React Native 0.88**, que ahora viene activada por defecto:
  `app/(tabs)/nube.tsx` → `TS2322: Type 'Element | null' is not assignable to type 'Element | ComponentType<any>
  | undefined'` en `ListEmptyComponent`. Se cambió `null` por `undefined`. No hubo imports profundos de
  `react-native/Libraries/*` ni `ref` con tipos viejos que fallaran.
- **Revisado y cambiado sin que fallara (preventivo, según la guía de Expo Router 58):**
  - El `router` de módulo en `fotos.tsx`, `mapa.tsx` y `foto/[id].tsx` pasó a `useRouter()`. En SDK 58, el
    `router` de módulo lanza un error si se usa antes del primer render. Aquí solo se usaba en `onPress`, pero
    la guía recomienda el hook.
  - `headerTransparent: false` en el detalle de la foto. En iOS 26+ el header pasa a ser transparente por
    defecto y el contenido quedaría debajo del header oscuro del tema. En Android no cambia nada.
- **Revisado sin cambios:** las 4 pestañas de `expo-router/js-tabs` están declaradas en el layout (SDK 58 oculta
  las que no lo estén); no se usa `initialRouteName`, `redirect`/`initialParams` en `Screen`, `freezeOnBlur`,
  `InteractionManager`, `Modal animated`, props eliminadas de `StatusBar`, `ImageBackground`, `Touchable`,
  `useNavigation`, `Linking.parse` ni `File.write()`. `Stack.Protected` sigue igual (`redirectTo` es opcional).
- **`tsconfig.json`: esta vez se aceptó el cambio en lugar de restaurarlo.** Se leyó el código de la CLI
  (`@expo/cli/.../type-generation`): cuando `app.json` no activa `experiments.typedRoutes`, `expo start` quita
  `.expo/types/**/*.ts` y `expo-env.d.ts` del `include` y borra `expo-env.d.ts`; si estuviera activo, los
  agregaría. Por eso se reescribía en cada arranque (también en las semanas 7 y 8). El changelog no lo
  menciona, pero es el comportamiento intencional de la CLI para un proyecto sin rutas tipadas. Restaurarlo
  dejaba el archivo modificado en cada `expo start`. Con el `include` nuevo, `npx tsc --noEmit` pasa.
- `drizzle/` no se tocó y no se regeneró ninguna migración; la base local del teléfono no cambia.
