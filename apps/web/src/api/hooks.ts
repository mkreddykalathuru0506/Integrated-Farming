/**
 * Exemplar TanStack Query hooks — the reference pattern for the panel sweep
 * (slice 11.6): queries via useFarmApi + farmKeys, mutations via
 * useApiMutation (toasts + invalidation). UnitsPanel is the first consumer.
 */
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../lib/useApiMutation';
import type { Batch, SpeciesSummary, Unit } from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

export function useUnits() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'units'),
    queryFn: async () => (await fetchJson<{ units: Unit[] }>('/api/farm/units')).units,
  });
}

export function useBatches() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'batches'),
    queryFn: async () => (await fetchJson<{ batches: Batch[] }>('/api/farm/batches')).batches,
  });
}

export function useSpecies() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'species'),
    queryFn: async () =>
      (await fetchJson<{ species: SpeciesSummary[] }>('/api/farm/species')).species,
  });
}

export function useCreateUnit() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ unit: Unit }, { name: string; type: string }>({
    mutationFn: (data) =>
      fetchJson('/api/farm/units', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'units.added',
    errorKeyByCode: { UNIT_NAME_TAKEN: 'units.duplicate' },
    invalidate: [farmKeys.list(farmId, 'units')],
  });
}

export function useDeleteUnit() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ ok: true }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/units/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    successKey: 'units.deleted',
    invalidate: [farmKeys.list(farmId, 'units')],
  });
}
