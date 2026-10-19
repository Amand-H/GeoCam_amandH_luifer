import { useCallback, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { toGeoPhoto } from '@/hooks/usePhotos';
import { uploadPhoto } from '@/services/cloudPhotos';

export interface SyncResult {
  ok: number;
  failed: number;
  errors: string[];
}

function messageOf(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Subidas a la nube para las pantallas. */
export function useCloudSync() {
  const { userId } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const { data } = useLiveQuery(photosRepo.pendingCountQuery());
  const pendingCount = data[0]?.count ?? 0;
  const isSyncing = progress !== null;

  /** Sube una foto. Devuelve null si salió bien o el mensaje de error. */
  const uploadOne = useCallback(
    async (id: number): Promise<string | null> => {
      if (!userId) return 'Inicia sesión para subir fotos';
      const row = photosRepo.detailQuery(id).get();
      if (!row) return 'Esta foto ya no existe';
      setIsUploading(true);
      try {
        await uploadPhoto(toGeoPhoto(row), userId);
        return null;
      } catch (e) {
        return messageOf(e, 'No se pudo subir la foto');
      } finally {
        setIsUploading(false);
      }
    },
    [userId]
  );

  /**
   * Sube las pendientes una por una (no Promise.all: una conexión móvil lenta se satura
   * y el progreso dejaría de tener sentido). Si una falla, se anota y se sigue con las demás.
   */
  const syncPending = useCallback(async (): Promise<SyncResult> => {
    if (!userId) return { ok: 0, failed: 0, errors: ['Inicia sesión para subir fotos'] };
    const pending = photosRepo.pendingForUpload();
    const result: SyncResult = { ok: 0, failed: 0, errors: [] };
    setProgress({ done: 0, total: pending.length });
    try {
      for (const [index, row] of pending.entries()) {
        try {
          await uploadPhoto(toGeoPhoto(row), userId);
          result.ok++;
        } catch (e) {
          result.failed++;
          result.errors.push(messageOf(e, 'No se pudo subir la foto'));
        }
        setProgress({ done: index + 1, total: pending.length });
      }
    } finally {
      setProgress(null);
    }
    return result;
  }, [userId]);

  return {
    uploadOne,
    syncPending,
    pendingCount,
    progress,
    isUploading: isUploading || isSyncing,
  };
}
