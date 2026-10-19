import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';
import { useOwnerId } from '@/hooks/useOwnerId';
import type { Album } from '@/types/geo';

/** Devuelve null si salió bien o un mensaje legible para mostrar en pantalla. */
async function run(action: () => Promise<unknown> | void): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ocurrió un error inesperado';
  }
}

export function useAlbums() {
  const ownerId = useOwnerId();
  const { data, error } = useLiveQuery(albumsRepo.listQuery(ownerId), [ownerId]);

  const albums: Album[] = useMemo(
    () => data.map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt.getTime() })),
    [data]
  );

  const createAlbum = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return Promise.resolve('El nombre no puede estar vacío');
    return run(() => albumsRepo.create(trimmed, ownerId));
  }, [ownerId]);

  const renameAlbum = useCallback((id: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return Promise.resolve('El nombre no puede estar vacío');
    return run(() => albumsRepo.rename(id, ownerId, trimmed));
  }, [ownerId]);

  const removeAlbum = useCallback((id: number) => run(() => albumsRepo.remove(id, ownerId)), [ownerId]);

  return { albums, createAlbum, renameAlbum, removeAlbum, error: error ?? null };
}
