import * as Network from 'expo-network';

/**
 * Única regla de "hay red" de la app. La usan `onlineManager` (lib/queryClient.ts) y
 * `isOnline()`, para que las dos no se contradigan.
 * Los campos de NetworkState son opcionales: isInternetReachable puede no venir, así que
 * solo se toma como offline cuando dice false explícitamente.
 */
export function isOnlineState(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Comprobación puntual (en el momento de llamarla) para acciones que no pueden esperar. */
export async function isOnline(): Promise<boolean> {
  try {
    return isOnlineState(await Network.getNetworkStateAsync());
  } catch {
    return false;
  }
}
