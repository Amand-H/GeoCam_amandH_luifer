import { useEffect, useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIsOnline } from '@/lib/queryClient';
import { listRemotePage, subscribeToRemoteChanges } from '@/services/cloudPhotos';
import type { CloudPhoto } from '@/types/geo';

/**
 * C2: feed de la pestaña Nube, paginado por cursor con useInfiniteQuery y búsqueda en vivo por nota.
 * Realtime ya no recarga a mano: invalida la consulta ['nube'] y TanStack Query vuelve a pedirla.
 */
export function useCloudPhotos(search: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const query = useInfiniteQuery({
    queryKey: ['nube', userId, { search: debouncedSearch }],
    queryFn: ({ pageParam }) => listRemotePage({ cursor: pageParam, search: debouncedSearch }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
    // Al cambiar la búsqueda se sigue mostrando la lista anterior hasta que llegue la nueva
    placeholderData: keepPreviousData,
  });

  // Depende de userId: al cambiar de cuenta se cierra el canal anterior y se abre el nuevo
  useEffect(() => {
    if (!userId) return;
    return subscribeToRemoteChanges(userId, () => {
      void queryClient.invalidateQueries({ queryKey: ['nube'] });
    });
  }, [userId, queryClient]);

  const photos: CloudPhoto[] = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data]
  );

  return {
    isOnline,
    photos,
    /** La búsqueda que ya se aplicó (la del campo puede ir 400 ms adelante). */
    appliedSearch: debouncedSearch,
    status: query.status,
    fetchStatus: query.fetchStatus,
    error: query.error,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
