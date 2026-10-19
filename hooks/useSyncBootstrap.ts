import { useEffect, useRef } from 'react';
import { photosRepo } from '@/db/repositories/photos';

/**
 * Completa clientId y updatedAt de las fotos antiguas una sola vez por arranque,
 * después de que las migraciones terminaron. Corre en un efecto para no bloquear el primer render.
 */
export function useSyncBootstrap(migrationsReady: boolean): void {
  const done = useRef(false);

  useEffect(() => {
    if (!migrationsReady || done.current) return;
    done.current = true;
    try {
      const filled = photosRepo.ensureSyncFields();
      if (__DEV__ && filled > 0) console.log(`[sync] ${filled} foto(s) recibieron clientId`);
    } catch (e) {
      if (__DEV__) console.warn('[sync] no se pudieron completar los campos de sincronización', e);
    }
  }, [migrationsReady]);
}
