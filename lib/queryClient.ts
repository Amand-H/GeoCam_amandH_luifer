// TanStack Query v5: solo ejecuta, reintenta y dispara la sincronización. La lógica vive en services/.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, defaultShouldDehydrateQuery, focusManager, onlineManager } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import Storage from 'expo-sqlite/kv-store';
import { isOnlineState } from '@/services/network';

/** C3: la caché guardada vale 24 h. Las consultas persistidas deben vivir (gcTime) al menos eso. */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      retry: 2,
    },
  },
});

// C3: el feed de la Nube sobrevive al cierre de la app. Si gcTime fuera menor que maxAge, la
// consulta se borraría de la caché (y del disco) antes de que la caché guardada venciera.
queryClient.setQueryDefaults(['nube'], { gcTime: PERSIST_MAX_AGE });

/**
 * C3: caché persistente en expo-sqlite/kv-store (ya tenemos expo-sqlite: no hace falta AsyncStorage).
 * La consulta ['sync'] NO se guarda: es un ciclo de sincronización, no datos para mostrar,
 * y restaurarla haría creer que la app ya sincronizó en esta sesión.
 */
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: createAsyncStoragePersister({ storage: Storage, key: 'geocam-query-cache' }),
  maxAge: PERSIST_MAX_AGE,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.queryKey[0] !== 'sync' && defaultShouldDehydrateQuery(query),
  },
};

// 1. TanStack Query se entera del estado de la red (expo-network, no window 'online')
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    if (__DEV__) console.log('[red] cambio', JSON.stringify(state), '→ online:', isOnlineState(state));
    setOnline(isOnlineState(state));
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (__DEV__) console.log('[red] inicial', JSON.stringify(state), '→ online:', isOnlineState(state));
      if (!initialised) setOnline(isOnlineState(state));
    })
    .catch(() => {});
  return () => subscription.remove();
});

// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
}
