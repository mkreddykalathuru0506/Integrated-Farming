/**
 * Shared server-pagination helper (slice 11.8a). Consumes the 11.5a `?page`
 * envelope ({ items, total, page, pageSize }) via useInfiniteQuery and exposes an
 * accumulating list + a "Load more" cursor. Panels keep client-side sort/search
 * over the ALREADY-loaded rows; older rows are pulled on demand instead of the
 * whole (append-only, daily-growing) table being downloaded on every mount.
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useFarmApi } from './FarmContext';

export type Envelope<T> = { items: T[]; total: number; page: number; pageSize: number };

/** Max server page size (ListQuerySchema caps at 100). */
export const PAGE_SIZE = 100;

/**
 * @param key       canonical query key (farmKeys.list(...))
 * @param buildPath (page, pageSize) => request path incl. any filters
 */
export function usePagedList<T>(
  key: readonly unknown[],
  buildPath: (page: number, pageSize: number) => string,
  pageSize = PAGE_SIZE,
) {
  const { fetchJson } = useFarmApi();
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchJson<Envelope<T>>(buildPath(pageParam, pageSize)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const items = query.data ? query.data.pages.flatMap((p) => p.items) : undefined;
  const total = query.data?.pages[0]?.total ?? 0;
  return {
    query,
    items,
    total,
    hasMore: query.hasNextPage ?? false,
    isPending: query.isPending,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
