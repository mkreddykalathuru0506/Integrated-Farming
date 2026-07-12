/**
 * Livestock domain hooks (slice 11.6a) — species / batches / animals /
 * mortality / movements / batch performance, all on the shared TanStack Query
 * kit: queries via useFarmApi + farmKeys, mutations via useApiMutation
 * (toasts + invalidation handled centrally). Colocated per the sweep playbook
 * so the shared api/hooks.ts stays conflict-free.
 */
import { useQuery } from '@tanstack/react-query';
import { qs } from '../lib/http';
import { useApiMutation } from '../lib/useApiMutation';
import type { Animal, Batch, SpeciesDetail } from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

// ---------- read-side row types (endpoints merged in slice 11.5a) ----------

export type MortalityRow = {
  id: string;
  type: 'MORTALITY' | 'CULL';
  count: number;
  cause: string | null;
  occurredAt: string;
  notes: string | null;
  batch: { id: string; code: string } | null;
  animal: { id: string; tagNumber: string | null } | null;
};

export type MovementRow = {
  id: string;
  batch: { id: string; code: string } | null;
  animal: { id: string; tagNumber: string | null } | null;
  fromUnitId: string | null;
  toUnitId: string | null;
  count: number | null;
  reason: string | null;
  movedAt: string;
};

/** GET /api/farm/batches/:id/performance — merged drill-down aggregate. */
export type BatchPerformance = {
  batch: {
    id: string;
    code: string;
    name: string | null;
    status: 'ACTIVE' | 'CLOSED';
    initialCount: number;
    currentCount: number;
    acquiredAt: string | null;
    species: { id: string; name: string };
    currentStage: { name: string } | null;
  };
  fcr: { feedConsumedKg: number; weightGainKg: number; feedCostPaise: string; fcr: number | null };
  cost: {
    totalPaise: string;
    costPerBirdPaise: string;
    currentCount: number;
    byCategory: Record<string, string>;
  };
  feedSeries: { occurredAt: string; qty: string; cumulativeKg: string }[];
  weightSeries: { loggedAt: string; quantity: number; unit: string }[];
  mortality: {
    ratePct: number;
    series: { occurredAt: string; type: string; count: number; cumulative: number }[];
  };
  timeline: ({ at: string; kind: string } & Record<string, unknown>)[];
};

// ---------- queries ----------

export function useSpeciesDetail(id: string | null) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'species', id ?? 'none'),
    queryFn: async () =>
      (await fetchJson<{ species: SpeciesDetail }>(`/api/farm/species/${encodeURIComponent(id!)}`))
        .species,
    enabled: id !== null,
  });
}

export function useAnimals() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'animals'),
    queryFn: async () => (await fetchJson<{ animals: Animal[] }>('/api/farm/animals')).animals,
  });
}

export function useBatchPerformance(batchId: string | null) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'performance', batchId ?? 'none'),
    queryFn: () =>
      fetchJson<BatchPerformance>(`/api/farm/batches/${encodeURIComponent(batchId!)}/performance`),
    enabled: batchId !== null,
  });
}

export function useMortalityEvents(filter: { batchId?: string; animalId?: string }, enabled = true) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'mortality', filter),
    queryFn: async () =>
      (await fetchJson<{ events: MortalityRow[] }>(`/api/farm/mortality${qs(filter)}`)).events,
    enabled,
  });
}

export function useMovements(filter: { batchId?: string; animalId?: string }, enabled = true) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'movements', filter),
    queryFn: async () =>
      (await fetchJson<{ movements: MovementRow[] }>(`/api/farm/movements${qs(filter)}`)).movements,
    enabled,
  });
}

// ---------- mutations ----------

/** Everything a livestock write can touch (lists + the performance drill-down). */
function livestockInvalidation(farmId: string) {
  return [
    farmKeys.list(farmId, 'batches'),
    farmKeys.list(farmId, 'animals'),
    farmKeys.list(farmId, 'mortality'),
    farmKeys.list(farmId, 'movements'),
    [...farmKeys.all(farmId), 'performance'],
  ] as const;
}

export type CreateBatchInput = {
  speciesId: string;
  code: string;
  initialCount: number;
  name?: string;
  breedId?: string;
  unitId?: string;
};

export function useCreateBatch() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ batch: Batch }, CreateBatchInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/batches', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'batches.added',
    errorKeyByCode: { BATCH_CODE_TAKEN: 'batches.duplicate' },
    invalidate: [farmKeys.list(farmId, 'batches')],
  });
}

export function useAdvanceBatch() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ batch: Batch }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/batches/${encodeURIComponent(id)}/advance`, { method: 'POST' }),
    successKey: 'batches.advanced',
    invalidate: livestockInvalidation(farmId),
  });
}

export function useCloseBatch() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ batch: Batch }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/batches/${encodeURIComponent(id)}/close`, { method: 'POST' }),
    successKey: 'batches.closed',
    invalidate: livestockInvalidation(farmId),
  });
}

export type RecordMortalityInput = {
  batchId?: string;
  animalId?: string;
  type: 'MORTALITY' | 'CULL';
  count?: number;
  cause?: string;
};

export function useRecordMortality() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, RecordMortalityInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/mortality', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'events.lossRecorded',
    invalidate: livestockInvalidation(farmId),
  });
}

export type RecordMovementInput = { batchId?: string; animalId?: string; toUnitId: string };

export function useRecordMovement() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, RecordMovementInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/movements', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'events.moved',
    invalidate: livestockInvalidation(farmId),
  });
}

export type CreateAnimalInput = {
  speciesId: string;
  tagNumber?: string;
  name?: string;
  sex?: string;
  breedId?: string;
  unitId?: string;
  dob?: string;
};

export function useCreateAnimal() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ animal: Animal }, CreateAnimalInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/animals', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'animals.added',
    errorKeyByCode: { ANIMAL_TAG_TAKEN: 'animals.duplicate' },
    invalidate: [farmKeys.list(farmId, 'animals')],
  });
}
