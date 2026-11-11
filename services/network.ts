import * as Network from 'expo-network';

/**
 * Única regla de "hay red" de la app. La usa `onlineManager` (lib/queryClient.ts); la UI la lee
 * con `useIsOnline()`. (La comprobación puntual del borrado se retiró con el borrado lógico, C1.)
 * Los campos de NetworkState son opcionales: isInternetReachable puede no venir, así que
 * solo se toma como offline cuando dice false explícitamente.
 */
export function isOnlineState(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}
