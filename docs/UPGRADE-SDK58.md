# Instrucciones para Claude Code — Actualizar GeoCam de Expo SDK 57 a SDK 58

> **Por qué:** Expo Go del teléfono se actualizó y ahora solo abre proyectos **SDK 58** ("Project is incompatible with this version of Expo Go"). Decisión de ING: **subir el proyecto a SDK 58**.
>
> En Claude Code pega:
> ```
> Lee docs/UPGRADE-SDK58.md completo y AGENTS.md. Ejecuta los pasos en orden.
> DETENTE en cada 🛑. Solo el remoto `mio`, nunca `origin`. Responde siempre en español.
> ```

---

## 0. Contexto

- Ramas: `main` (= `mio/main`, Semana 8, `af6c52d`), `semana-9-sync` (1 commit: `68bdfaa`, T1), `semana-10-ia` (Semana 10 a medias, guardada).
- **La actualización se hace UNA sola vez, sobre `main`**, en su propia rama `upgrade-sdk58`. Después se rebasan encima `semana-9-sync` (y más adelante `semana-10-ia`). Así no se hace el upgrade tres veces.
- Fuentes oficiales que DEBES leer antes de tocar nada (no confíes en tu memoria: SDK 58 es posterior a tu entrenamiento):
  - https://expo.dev/blog/how-to-upgrade-to-sdk-58
  - https://expo.dev/changelog/sdk-58
  - https://docs.expo.dev/router/migrate/sdk-57-to-58/
  - Doc versionada nueva: `https://docs.expo.dev/versions/v58.0.0/`
- Lo que ya se sabe del cambio: React Native **0.86 → 0.88**; **TypeScript estricto por defecto** (los `import` profundos de `react-native/Libraries/*` dan error de tipos; los `ref` usan tipos de instancia como `ViewInstance`, `TextInputInstance`); se eliminaron `InteractionManager`, la exportación `Touchable`, la prop `animated` de `Modal` y las props `backgroundColor`/`translucent`/`networkActivityIndicatorVisible` de `StatusBar`; `ImageBackground` deprecado. Expo Router: tabs/drawer **solo muestran pantallas declaradas** en el layout (ocultar con `href: null`), `initialRouteName` → `unstable_settings = { anchor }`, `Stack.Protected` admite `redirectTo`, el `router` de módulo falla antes del primer render (usar `useRouter`), `useNavigation` falla fuera de un navegador, `freezeOnBlur` ya no hace nada.

---

## PASO 1 — Rama y respaldo

```bash
git status                       # debe estar limpio salvo PDF, video, "Claude outputs/", supabase/.temp/, docs/SEMANA10.md
git checkout main && git pull mio main
git checkout -b upgrade-sdk58
```

## PASO 2 — Actualizar paquetes

```bash
npx expo install expo@^58.0.0 --fix
npx expo install --fix
npx expo-doctor@latest
```
- Si `npm` da `ERESOLVE`, crea `.npmrc` con `legacy-peer-deps=true` y repite.
- Revisa que **todos** los paquetes de Expo/React Native queden en las versiones que pide SDK 58 (`expo-sqlite`, `expo-file-system`, `expo-camera`, `expo-location`, `expo-secure-store`, `expo-crypto`, `expo-sensors`, `expo-image-picker`, `expo-network` si está, `expo-router`, `react-native-maps`, `react-native-screens`, `react-native-safe-area-context`, `react`, `react-native`, `@types/react`, `typescript`).
- `drizzle-orm`, `drizzle-kit` y `@supabase/supabase-js` no son de Expo: déjalos salvo que `expo-doctor` o el build lo exijan.
- Muéstrame la tabla de versiones **antes → después**.

## PASO 3 — Corregir lo que rompa

```bash
npx tsc --noEmit
npx expo lint
```
Arregla los errores siguiendo las guías oficiales (sección 0). En especial revisa:
1. **Expo Router:** `app/_layout.tsx` (`Stack.Protected`, pantallas de carga/error de migraciones), `app/(tabs)/_layout.tsx` (Tabs de `expo-router/js-tabs`: todas las pestañas declaradas), `app/index.tsx` (`Redirect`), `app/foto/[id].tsx` (header), cualquier uso de `router` de módulo o `initialRouteName`.
2. **Tipos estrictos de RN 0.88:** `ref` de `TextInput`, `FlatList`, `MapView`, `CameraView`; imports profundos.
3. `StatusBar`, `Modal`, `InteractionManager`, `ImageBackground`, `Touchable*` si aparecen.
4. `tsconfig.json`: si `expo start` lo reescribe, revisa si en SDK 58 ese cambio es el nuevo estándar (lee el changelog) antes de restaurarlo. Explícame la decisión.
5. **No toques** la lógica de datos (Drizzle, Supabase, sincronización) salvo que no compile. **No regeneres** migraciones: `drizzle/` queda igual.

## PASO 4 — Actualizar documentación del repo

- `AGENTS.md`: cambiar las referencias a `v57.0.0` por `v58.0.0`.
- `docs/SEMANA9.md` y `docs/SEMANA10.md`: donde digan SDK 57 / `v57.0.0`, dejar una nota al inicio: "El proyecto está en SDK 58; usar `https://docs.expo.dev/versions/v58.0.0/`". (`docs/SEMANA10.md` sigue **sin versionar**.)
- `README.md`: versión de Expo en la sección de requisitos.
- `AI-LOG.md` (sección nueva "Actualización a SDK 58"): qué rompió y cómo se arregló, con los errores reales.

✅ Commit: `chore: actualizar a Expo SDK 58 (React Native 0.88)`

## 🛑 PASO 5 — Prueba en el teléfono (ING)

```bash
npx expo start -c
```
ING abre con **Expo Go SDK 58** y prueba: login, cámara, ubicación, Fotos, Mapa, detalle, Nube (imágenes cargan), Sincronizar, shake, cerrar sesión. Las fotos anteriores deben seguir ahí (la base local no cambia).

Si algo falla, ING te pega el error y lo corriges en la misma rama.

## PASO 6 — Integrar

Cuando ING confirme que todo funciona:
```bash
git checkout main
git merge upgrade-sdk58
git push mio main

git checkout semana-9-sync
git rebase main
npm install
npx tsc --noEmit && npx expo lint
git push -u mio semana-9-sync --force-with-lease
```
- `semana-10-ia` **NO se toca ahora**: se rebasa sobre `main` cuando se retome la Semana 10. Aviso para ese momento: su `polyfills.ts` hace un import profundo (`react-native/Libraries/Utilities/PolyfillFunctions`), que con el TypeScript estricto de RN 0.88 puede dar error de tipos; habrá que revisarlo contra la guía del AI SDK para Expo.

Después de esto, sigue con la **Fase 2 de `docs/SEMANA9.md`** (TanStack Query), usando la documentación de SDK 58.

## Checklist
- [ ] `npx expo-doctor` sin errores.
- [ ] `npx tsc --noEmit` y `npx expo lint` sin errores.
- [ ] La app abre en Expo Go SDK 58 y todas las pantallas funcionan.
- [ ] `drizzle/` sin cambios; fotos locales intactas.
- [ ] `.env` fuera del repo.
- [ ] `main` con el upgrade en `mio`; `semana-9-sync` rebasada.
