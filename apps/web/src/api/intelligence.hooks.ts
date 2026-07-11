/**
 * Canonical intelligence data layer (slice 11.8a). ONE query key per endpoint
 * for open risks and the due rollup — shared by the dashboard, the Weather
 * panel, the notification bell and the sidebar attention dot. Previously the
 * same two endpoints were cached under 'risk' / 'risks' / 'bell' fragments, so
 * acking a risk on one surface left the others stale. Now every risk/reminder-
 * changing mutation (ack, weather refresh, market refresh, intelligence sweep)
 * invalidates these same keys, so no surface serves a stale copy.
 */
import { useQuery } from '@tanstack/react-query';
import type { RiskFlag } from '../farm/api';
import { useApiMutation } from '../lib/useApiMutation';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

/** GET /api/farm/due?days=N — the merged reminder rollup the dashboard + bell render. */
export type DueRollup = {
  counts: { vaccinations: number; maintenance: number; emi: number; insurance: number; tasks: number };
  vaccinations: {
    batch: { id: string; code: string };
    due: { id: string; vaccineName: string; ageDays: number }[];
  }[];
  maintenance: { id: string; name: string; nextDueDate: string | null; asset: { name: string } }[];
  emiDue: { id: string; lender: string; nextDueDate: string | null }[];
  policiesExpiring: { id: string; provider: string; endDate: string }[];
  tasksToday: { id: string; title: string }[];
};

/**
 * Canonical cache keys. The keys factory makes `farmKeys.list(id,'risk')`
 * (no params) a prefix of every params variant, so invalidating it refreshes
 * `openRisksKey` too — that is why the invalidation list uses the param-less form.
 */
export const openRisksKey = (farmId: string) => farmKeys.list(farmId, 'risk', { status: 'OPEN' });
export const dueKey = (farmId: string, days: number) => farmKeys.list(farmId, 'due', { days });

/** Keys every risk/reminder-mutating surface must invalidate (ack, refresh, sweep). */
export const intelInvalidation = (farmId: string) =>
  [
    farmKeys.list(farmId, 'risk'),
    farmKeys.list(farmId, 'due'),
    farmKeys.list(farmId, 'dashboard'),
    farmKeys.list(farmId, 'alerts'),
  ] as const;

type QueryOpts = { refetchInterval?: number; staleTime?: number };

/** Open risk flags (GET /api/farm/risk?status=OPEN). Pass poll options for the bell. */
export function useOpenRisks(options?: QueryOpts) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: openRisksKey(farmId),
    queryFn: async () => (await fetchJson<{ risks: RiskFlag[] }>('/api/farm/risk?status=OPEN')).risks,
    ...options,
  });
}

/** Due/overdue reminder rollup (GET /api/farm/due?days=N). */
export function useDue(days = 7, options?: QueryOpts) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: dueKey(farmId, days),
    queryFn: () => fetchJson<DueRollup>(`/api/farm/due?days=${days}`),
    ...options,
  });
}

/**
 * Acknowledge a risk (POST /api/farm/risk/:id/ack). One canonical mutation used
 * by the dashboard, the Weather panel and the bell — the toast copy is the only
 * per-surface difference, so it is a parameter; invalidation is always canonical.
 */
export function useAckRisk(successKey = 'weather.acked') {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/risk/${encodeURIComponent(id)}/ack`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    successKey,
    invalidate: intelInvalidation(farmId),
  });
}
