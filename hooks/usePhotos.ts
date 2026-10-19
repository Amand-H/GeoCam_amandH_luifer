import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';
import { useAlbumsVersion } from '@/hooks/useAlbumsVersion';
import { useOwnerId } from '@/hooks/useOwnerId';
import { deleteRemote, deleteRemoteMany } from '@/services/cloudPhotos';
import { isOnline } from '@/services/network';
import { deletePhotoFile, persistPhoto } from '@/services/photoFiles';
import type { Coords, GeoPhoto, PhotoFilters } from '@/types/geo';

export interface NewPhotoInput {
  uri: string;
  source: GeoPhoto['source'];
  coords: Coords | null;
}

type PhotoRow = Photo & { albumName: string | null };

/** Fila plana de SQLite → objeto de dominio con coords anidadas. */
export function toGeoPhoto(row: PhotoRow): GeoPhoto {
  const createdAt = row.createdAt.getTime();
  const syncedAt = row.syncedAt?.getTime() ?? null;
  const updatedAt = row.updatedAt?.getTime() ?? null;
  const coords: Coords | null =
    row.latitude !== null && row.longitude !== null
      ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, timestamp: createdAt }
      : null;
  return {
    id: row.id,
    uri: row.uri,
    coords,
    source: row.source,
    createdAt,
    note: row.note,
    favorite: row.favorite,
    albumId: row.albumId,
    albumName: row.albumName,
    clientId: row.clientId,
    remotePath: row.remotePath,
    syncedAt,
    updatedAt,
    isSynced: syncedAt !== null && (updatedAt === null || syncedAt >= updatedAt),
  };
}

const OFFLINE_ONE = 'Sin conexión: la foto está en la nube y no se borró. Inténtalo con internet.';
const OFFLINE_ALL = 'Sin conexión: hay fotos en la nube, así que no se borró ninguna. Inténtalo con internet.';

/**
 * Compartida con usePhoto para que borrar desde el detalle haga lo mismo que desde el mapa.
 * Orden: nube (fila → archivo) → registro local → archivo local.
 * Si la parte remota falla o no hay conexión se lanza el error y no se toca nada local:
 * así nunca queda una foto en la nube sin su copia en el teléfono que permita borrarla.
 */
export async function removePhotoById(id: number, ownerId: string): Promise<void> {
  const row = photosRepo.findById(id, ownerId);
  if (!row) return;
  if (row.remotePath) {
    if (!(await isOnline())) throw new Error(OFFLINE_ONE);
    await deleteRemote(row);
  }
  await photosRepo.remove(id, ownerId);
  deletePhotoFile(row.uri);
}

export function usePhotos({ search = '', albumId = null, onlyFavorites = false }: PhotoFilters = {}) {
  const ownerId = useOwnerId();
  const albumsVersion = useAlbumsVersion();
  // Las dependencias hacen que la consulta se reconstruya al cambiar un filtro o de cuenta
  const filtered = useLiveQuery(photosRepo.filteredQuery(ownerId, { search, albumId, onlyFavorites }), [
    ownerId,
    search,
    albumId,
    onlyFavorites,
    albumsVersion,
  ]);
  const located = useLiveQuery(photosRepo.withLocationQuery(ownerId), [ownerId, albumsVersion]);

  const photos = useMemo(() => filtered.data.map(toGeoPhoto), [filtered.data]);
  const photosWithLocation = useMemo(() => located.data.map(toGeoPhoto), [located.data]);

  const addPhoto = useCallback(async ({ uri, source, coords }: NewPhotoInput) => {
    const permanentUri = await persistPhoto(uri);
    try {
      await photosRepo.create(
        {
          uri: permanentUri,
          source,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          accuracy: coords?.accuracy ?? null,
        },
        ownerId
      );
    } catch (e) {
      // Sin registro el archivo quedaría huérfano
      deletePhotoFile(permanentUri);
      throw e;
    }
  }, [ownerId]);

  const removePhoto = useCallback((id: number) => removePhotoById(id, ownerId), [ownerId]);

  /** Misma regla que removePhotoById para todas a la vez: o se borra todo o no se borra nada. */
  const clearAll = useCallback(async () => {
    const rows = photosRepo.allUris(ownerId);
    if (rows.some((r) => r.remotePath)) {
      if (!(await isOnline())) throw new Error(OFFLINE_ALL);
      await deleteRemoteMany(rows);
    }
    await photosRepo.clearAll(ownerId);
    rows.forEach(({ uri }) => deletePhotoFile(uri));
  }, [ownerId]);

  return {
    photos,
    photosWithLocation,
    addPhoto,
    removePhoto,
    clearAll,
    error: filtered.error ?? located.error ?? null,
  };
}
