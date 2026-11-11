// TanStack Query v5: solo ejecuta, reintenta y dispara la sincronización. La lógica vive en services/.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { isOnlineState } from '@/services/network';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      retry: 2,
    },
  },
});

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
