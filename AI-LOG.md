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
