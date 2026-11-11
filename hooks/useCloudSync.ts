import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { canUpload, syncAll } from '@/services/sync';

// Provisional (Semana 9, Fase 4): ya no tiene su propia subida, todo pasa por syncAll().
// La Fase 5 lo reemplaza por useSync + indicador de estado.
export { canUpload };

export interface SyncResult {
  ok: number;
  failed: number;
  /** Pendientes que nunca se subieron y cuyo archivo ya no está en el teléfono: no se intentan. */
  missingFile: number;
  errors: string[];
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Sincronización a pedido para las pantallas (botón Sincronizar y "Subir" del detalle). */
export function useCloudSync() {
  const { userId } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  // '' al cerrar sesión: no coincide con ninguna fila (ver useOwnerId)
  const { data } = useLiveQuery(photosRepo.pendingQuery(userId ?? ''), [userId]);
  // Las pendientes sin archivo no cuentan en el botón: no hay nada que subir
  const { pendingCount, missingFileCount } = useMemo(() => {
    const uploadable = data.filter(canUpload).length;
    return { pendingCount: uploadable, missingFileCount: data.length - uploadable };
  }, [data]);

  /** Un ciclo completo bajar → subir. */
  const syncPending = useCallback(async (): Promise<SyncResult> => {
    if (!userId) return { ok: 0, failed: 0, missingFile: 0, errors: ['Inicia sesión para subir fotos'] };
    setIsUploading(true);
    try {
      const r = await syncAll(userId);
      return { ok: r.pushed, failed: r.failed, missingFile: r.sinArchivo, errors: r.errors };
    } catch (e) {
      return { ok: 0, failed: 0, missingFile: 0, errors: [messageOf(e, 'No se pudo sincronizar')] };
    } finally {
      setIsUploading(false);
    }
  }, [userId]);

  /** "Subir" desde el detalle: lanza el mismo ciclo. Devuelve null si salió bien o el primer error. */
  const uploadOne = useCallback(
    async (_id: number): Promise<string | null> => {
      const { errors } = await syncPending();
      return errors[0] ?? null;
    },
    [syncPending]
  );

  return { uploadOne, syncPending, pendingCount, missingFileCount, isUploading };
}
