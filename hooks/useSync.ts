// La sincronización tratada como una consulta de TanStack Query: se dispara al iniciar sesión,
// al recuperar la red y al volver a primer plano, y se reintenta si falla. La lógica vive en services/sync.ts.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { queryClient, useIsOnline } from '@/lib/queryClient';
import { canUpload, syncAll } from '@/services/sync';

export { canUpload, isPending } from '@/services/sync';
export type { SyncResult } from '@/services/sync';

/**
 * Pide un ciclo de sincronización después de un cambio local.
 * Sin red, la consulta queda en pausa (networkMode 'online') y se reanuda sola al reconectar.
 */
export function requestSync() {
  void queryClient.invalidateQueries({ queryKey: ['sync'] });
}

export function useSync() {
  const { userId } = useAuth();
  const isOnline = useIsOnline();

  // '' al cerrar sesión: no coincide con ninguna fila (ver useOwnerId)
  const { data: pending } = useLiveQuery(photosRepo.pendingQuery(userId ?? ''), [userId]);
  // Las pendientes sin archivo no se pueden subir: se cuentan aparte
  const { pendingCount, sinArchivoCount } = useMemo(() => {
    const uploadable = pending.filter(canUpload).length;
    return { pendingCount: uploadable, sinArchivoCount: pending.length - uploadable };
  }, [pending]);

  const sync = useQuery({
    queryKey: ['sync', userId],
    queryFn: () => syncAll(userId!),
    enabled: !!userId,
    staleTime: 0,
    retry: 2,
    refetchOnReconnect: 'always', // volvió la red
    refetchOnWindowFocus: 'always', // la app volvió a primer plano
  });

  return {
    isOnline,
    pendingCount,
    sinArchivoCount,
    isSyncing: sync.fetchStatus === 'fetching',
    lastResult: sync.data,
    error: sync.error,
    /** Sincronizar ya (indicador o botón). Devuelve el resultado del ciclo. */
    syncNow: () => sync.refetch(),
  };
}
