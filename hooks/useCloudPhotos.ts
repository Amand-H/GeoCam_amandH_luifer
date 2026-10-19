import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listRemote, subscribeToRemoteChanges } from '@/services/cloudPhotos';
import type { CloudPhoto } from '@/types/geo';

/** Fotos del usuario en la nube, actualizadas en vivo con Realtime. Solo lee: no descarga a SQLite. */
export function useCloudPhotos() {
  const { userId } = useAuth();
  const [photos, setPhotos] = useState<CloudPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si llegan varios eventos seguidos, solo cuenta la respuesta de la última petición
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) return;
    const current = ++requestId.current;
    setIsLoading(true);
    try {
      const result = await listRemote();
      if (current !== requestId.current) return;
      setPhotos(result);
      setError(null);
    } catch (e) {
      if (current !== requestId.current) return;
      setError(e instanceof Error ? e.message : 'No se pudo cargar la nube');
    } finally {
      if (current === requestId.current) setIsLoading(false);
    }
  }, [userId]);

  // Depende de userId: al cambiar de cuenta se limpia, se recarga y se re-suscribe al canal nuevo
  useEffect(() => {
    setPhotos([]);
    setError(null);
    if (!userId) return;
    reload();
    return subscribeToRemoteChanges(userId, reload);
  }, [userId, reload]);

  return { photos, isLoading, error, reload };
}
