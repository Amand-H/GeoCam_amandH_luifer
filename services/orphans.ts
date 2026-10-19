import * as SecureStore from 'expo-secure-store';
import { albumsRepo } from '@/db/repositories/albums';
import { photosRepo } from '@/db/repositories/photos';

// Guarda el id del usuario que se quedó con los datos anteriores a la Semana 8
const CLAIMED_KEY = 'geocam.orphansClaimed';

/**
 * Las fotos y álbumes creados antes de la migración 0004 no tienen dueño.
 * El primer usuario que inicia sesión en este teléfono se queda con ellos, una sola vez:
 * la marca en SecureStore evita que un segundo usuario se lleve lo que cree el primero
 * después (nunca habrá filas sin dueño nuevas, pero la regla queda explícita).
 */
export async function claimOrphansOnce(userId: string): Promise<void> {
  if (await SecureStore.getItemAsync(CLAIMED_KEY)) return;
  photosRepo.claimOrphans(userId);
  albumsRepo.claimOrphans(userId);
  await SecureStore.setItemAsync(CLAIMED_KEY, userId);
}
