# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Luis Nuñez, Amand Herrera
**Semana:** 8
**Proyecto:** GeoCam en la nube – Taller Integrador 2
**Herramienta:** Claude Code

> Registros anteriores: [Semana 7](docs/ai-log/AI-LOG-semana-7.md) · [Semana 6](docs/ai-log/AI-LOG-semana-6.md).
> Este registro se completa en la Fase 11; por ahora contiene lo ocurrido hasta la Fase 6.

## 1. Prompts Utilizados

_(Se completa en la Fase 11.)_

## 2. Código Generado vs. Código Modificado

_(Se completa en la Fase 11.)_

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
