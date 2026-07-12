/**
 * Audit-trail feed hooks (slice 11.9) — GET /api/farm/audit is cursor-paginated
 * ({ items, nextCursor }), unlike the page-envelope lists, so it gets its own
 * useInfiniteQuery instead of usePagedList. OWNER/MANAGER only (server-gated).
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { qs } from '../lib/http';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  /** null = system/deleted user. */
  user: { id: string; name: string } | null;
};

export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

export type ActivityFilter = { entity?: string; action?: string };

/** Reverse-chron audit feed with "Load more" via the opaque `cursor` (last item id). */
export function useActivity(filter: ActivityFilter = {}, opts: { limit?: number; enabled?: boolean } = {}) {
  const { farmId, fetchJson } = useFarmApi();
  const limit = opts.limit ?? 50;
  const query = useInfiniteQuery({
    queryKey: farmKeys.list(farmId, 'audit', {
      entity: filter.entity ?? '',
      action: filter.action ?? '',
    }),
    queryFn: ({ pageParam }) =>
      fetchJson<ActivityPage>(
        `/api/farm/audit${qs({ limit, entity: filter.entity, action: filter.action, cursor: pageParam })}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: opts.enabled ?? true,
  });
  const items = query.data ? query.data.pages.flatMap((p) => p.items) : undefined;
  return {
    items,
    hasMore: query.hasNextPage ?? false,
    isPending: query.isPending,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
