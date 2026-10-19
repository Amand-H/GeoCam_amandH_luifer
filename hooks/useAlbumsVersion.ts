import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';
import { useOwnerId } from '@/hooks/useOwnerId';

/**
 * useLiveQuery solo escucha la tabla del FROM. Las consultas de fotos hacen join con albums,
 * así que se pasa esta marca de tiempo como dependencia para que se recalculen al renombrar
 * o borrar un álbum.
 */
export function useAlbumsVersion(): number | undefined {
  const ownerId = useOwnerId();
  const { updatedAt } = useLiveQuery(albumsRepo.listQuery(ownerId), [ownerId]);
  return updatedAt?.getTime();
}
