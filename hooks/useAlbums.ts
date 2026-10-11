import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';
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
  const { data, error } = useLiveQuery(albumsRepo.listQuery());

  const albums: Album[] = useMemo(
    () => data.map((row) => ({ id: row.id, name: row.name, createdAt: row.createdAt.getTime() })),
    [data]
  );

  const createAlbum = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return Promise.resolve('El nombre no puede estar vacío');
    return run(() => albumsRepo.create(trimmed));
  }, []);

  const renameAlbum = useCallback((id: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return Promise.resolve('El nombre no puede estar vacío');
    return run(() => albumsRepo.rename(id, trimmed));
  }, []);

  const removeAlbum = useCallback((id: number) => run(() => albumsRepo.remove(id)), []);

  return { albums, createAlbum, renameAlbum, removeAlbum, error: error ?? null };
}
