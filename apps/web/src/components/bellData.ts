import { useQuery } from '@tanstack/react-query';
import { useFarmApi } from '../api/FarmContext';
import type { DueRollup, OpenRisk } from './bell';

/**
 * The bell's two polled queries, exported separately so other shell pieces
 * (e.g. the sidebar unread dot) can share the same cache entries — TanStack
 * dedupes by key, so this costs no extra requests.
 */

const POLL = { refetchInterval: 60_000, staleTime: 55_000 } as const;

export function useOpenRisks() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: ['farm', farmId, 'bell', 'risk'] as const,
    queryFn: async () => (await fetchJson<{ risks: OpenRisk[] }>('/api/farm/risk?status=OPEN')).risks,
    ...POLL,
  });
}

export function useDueRollup() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: ['farm', farmId, 'bell', 'due'] as const,
    queryFn: () => fetchJson<DueRollup>('/api/farm/due?days=7'),
    ...POLL,
  });
}
