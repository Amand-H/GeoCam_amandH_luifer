import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { toGeoPhoto } from '@/hooks/usePhotos';
import { uploadPhoto } from '@/services/cloudPhotos';

/** Subidas a la nube para las pantallas. Devuelve null si salió bien o el mensaje de error. */
export function useCloudSync() {
  const { userId } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

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
        return e instanceof Error ? e.message : 'No se pudo subir la foto';
      } finally {
        setIsUploading(false);
      }
    },
    [userId]
  );

  return { uploadOne, isUploading };
}
