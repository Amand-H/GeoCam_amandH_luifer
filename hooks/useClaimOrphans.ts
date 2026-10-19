import { useEffect } from 'react';
import { claimOrphansOnce } from '@/services/orphans';

/** Al iniciar sesión, asigna al usuario los datos sin dueño (solo la primera vez en este teléfono). */
export function useClaimOrphans(userId: string | null): void {
  useEffect(() => {
    if (!userId) return;
    claimOrphansOnce(userId).catch((e) => {
      if (__DEV__) console.warn('[orphans] no se pudieron asignar los datos anteriores', e);
    });
  }, [userId]);
}
