import * as Network from 'expo-network';

/**
 * ¿Hay internet ahora? Los campos de NetworkState son opcionales: isInternetReachable
 * puede no venir, así que solo se toma como offline cuando dice false explícitamente.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return false;
  }
}
