import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';
import type { Coords, GeoPhoto } from '@/types/geo';

export interface NewPhotoInput {
  uri: string;
  source: GeoPhoto['source'];
  coords: Coords | null;
}

/** Fila plana de SQLite → objeto de dominio con coords anidadas. */
function toGeoPhoto(row: Photo): GeoPhoto {
  const createdAt = row.createdAt.getTime();
  const coords: Coords | null =
    row.latitude !== null && row.longitude !== null
      ? { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, timestamp: createdAt }
      : null;
  return { id: row.id, uri: row.uri, coords, source: row.source, createdAt };
}

export function usePhotos() {
  const all = useLiveQuery(photosRepo.listQuery());
  const located = useLiveQuery(photosRepo.withLocationQuery());

  const photos = useMemo(() => all.data.map(toGeoPhoto), [all.data]);
  const photosWithLocation = useMemo(() => located.data.map(toGeoPhoto), [located.data]);

  const addPhoto = useCallback(async ({ uri, source, coords }: NewPhotoInput) => {
    await photosRepo.create({
      uri,
      source,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
    });
  }, []);

  const removePhoto = useCallback(async (id: number) => {
    await photosRepo.remove(id);
  }, []);

  const clearAll = useCallback(async () => {
    await photosRepo.clearAll();
  }, []);

  return {
    photos,
    photosWithLocation,
    addPhoto,
    removePhoto,
    clearAll,
    error: all.error ?? located.error ?? null,
  };
}
