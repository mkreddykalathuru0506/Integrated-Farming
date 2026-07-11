/**
 * TanStack Query hooks for the health group (slice 11.6b): health records +
 * medication withdrawal, vaccinations, breeding, hatchery. Colocated here
 * (not in api/hooks.ts) so parallel sweep slices don't collide on one file.
 * Pattern mirrors api/hooks.ts: reads via useQuery + farmKeys, writes via
 * useApiMutation (central toasts + invalidation).
 */
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { qs } from '../lib/http';
import { useApiMutation } from '../lib/useApiMutation';
import type { Animal, SpeciesDetail } from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

// ---------------------------------------------------------------- shared

export function useAnimals() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'animals'),
    queryFn: async () => (await fetchJson<{ animals: Animal[] }>('/api/farm/animals')).animals,
  });
}

export function useSpeciesDetail(id: string | undefined) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'species', id ?? ''),
    queryFn: async () =>
      (await fetchJson<{ species: SpeciesDetail }>(`/api/farm/species/${encodeURIComponent(id!)}`)).species,
    enabled: !!id,
  });
}

/** `YYYY-MM-DD` for today in Asia/Kolkata — default value for date inputs. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// ------------------------------------------------------ health records

export const HEALTH_EVENT_TYPES = [
  'CHECKUP',
  'SYMPTOM',
  'TREATMENT',
  'VET_VISIT',
  'VACCINATION',
  'DEWORMING',
] as const;
export type HealthEventType = (typeof HEALTH_EVENT_TYPES)[number];

export type HealthRecord = {
  id: string;
  type: HealthEventType;
  occurredAt: string;
  description: string | null;
  vetName: string | null;
  animalId: string | null;
  batchId: string | null;
};

export function useHealthRecords() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'health-records'),
    queryFn: async () =>
      (await fetchJson<{ records: HealthRecord[] }>('/api/farm/health/records')).records,
  });
}

export type CreateHealthRecordData = {
  batchId?: string;
  animalId?: string;
  type: HealthEventType;
  occurredAt?: string;
  description?: string;
  vetName?: string;
  diagnosis?: string;
};

export function useCreateHealthRecord() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ record: HealthRecord }, CreateHealthRecordData>({
    mutationFn: (data) =>
      fetchJson('/api/farm/health/records', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'health.eventRecorded',
    invalidate: [farmKeys.list(farmId, 'health-records')],
  });
}

// ---------------------------------------------------------- withdrawal

export type WithdrawalStatus = { underWithdrawal: boolean; until: string | null };
export type BatchWithdrawal = WithdrawalStatus & { batchId: string };

/**
 * Per-batch withdrawal checks, one query per ACTIVE batch (bounded fan-out).
 * Keys are `list` variants so a single prefix invalidation refreshes them all.
 */
export function useWithdrawals(batchIds: string[]) {
  const { farmId, fetchJson } = useFarmApi();
  return useQueries({
    queries: batchIds.map((batchId) => ({
      queryKey: farmKeys.list(farmId, 'health-withdrawal', { batchId }),
      queryFn: async (): Promise<BatchWithdrawal> => ({
        batchId,
        ...(await fetchJson<WithdrawalStatus>(`/api/farm/health/withdrawal${qs({ batchId })}`)),
      }),
    })),
  });
}

export type RecordMedicationData = {
  batchId: string;
  drugName: string;
  dose?: string;
  route?: string;
  withdrawalDays: number;
};

export function useRecordMedication() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, RecordMedicationData>({
    mutationFn: (data) =>
      fetchJson('/api/farm/health/medications', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'health.medRecorded',
    invalidate: [farmKeys.list(farmId, 'health-withdrawal')],
  });
}

export function useMarkSaleReady() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, { batchId: string }>({
    mutationFn: (data) =>
      fetchJson('/api/farm/health/sale-ready', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'health.saleReadyOk',
    errorKeyByCode: { WITHDRAWAL_ACTIVE: 'health.blocked' },
    invalidate: [farmKeys.list(farmId, 'health-withdrawal')],
  });
}

// -------------------------------------------------------- vaccinations

export type VaxItem = { id: string; vaccineName: string; type: string; ageDays: number };
export type Vaccinations = { ageDays: number; due: VaxItem[]; upcoming: VaxItem[]; done: VaxItem[] };

export function useVaccinations(batchId: string | undefined) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'vaccinations', { batchId: batchId ?? '' }),
    queryFn: () => fetchJson<Vaccinations>(`/api/farm/health/vaccinations${qs({ batchId })}`),
    enabled: !!batchId,
  });
}

export function useRecordVaccination() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, { batchId: string; vaccineName: string; scheduleItemId?: string }>({
    mutationFn: (data) =>
      fetchJson('/api/farm/health/vaccinations', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'vax.recorded',
    invalidate: [farmKeys.list(farmId, 'vaccinations')],
  });
}

// ------------------------------------------------------------ breeding

export const BREEDING_STATUSES = ['PLANNED', 'CONFIRMED', 'COMPLETED', 'FAILED'] as const;
export type BreedingStatus = (typeof BREEDING_STATUSES)[number];

export type BreedingRecord = {
  id: string;
  speciesId: string | null;
  damId: string | null;
  sireId: string | null;
  method: string | null;
  breedingDate: string;
  expectedDueDate: string | null;
  status: BreedingStatus;
  offspringCount: number | null;
};

export function useBreeding() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'breeding'),
    queryFn: async () =>
      (await fetchJson<{ records: BreedingRecord[] }>('/api/farm/breeding')).records,
  });
}

export type CreateBreedingData = {
  speciesId?: string;
  damId?: string;
  sireId?: string;
  method?: string;
  breedingDate: string;
  expectedDueDate?: string;
  notes?: string;
};

export function useCreateBreeding() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ record: BreedingRecord }, CreateBreedingData>({
    mutationFn: (data) =>
      fetchJson('/api/farm/breeding', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'breeding.added',
    invalidate: [farmKeys.list(farmId, 'breeding')],
  });
}

export type UpdateBreedingData = { status?: BreedingStatus; offspringCount?: number };

export function useUpdateBreeding() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ record: BreedingRecord }, { id: string; data: UpdateBreedingData }>({
    mutationFn: ({ id, data }) =>
      fetchJson(`/api/farm/breeding/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    successKey: 'breeding.updated',
    invalidate: [farmKeys.list(farmId, 'breeding')],
  });
}

// ------------------------------------------------------------ hatchery

export const HATCH_STATUSES = ['SET', 'INCUBATING', 'CANDLED', 'LOCKDOWN', 'HATCHED', 'CLOSED'] as const;
export type HatchStatus = (typeof HATCH_STATUSES)[number];

export const INCUBATION_EVENTS = ['CANDLING', 'LOCKDOWN', 'HATCH', 'TEMP_LOG', 'TURN', 'OTHER'] as const;
export type IncubationEventType = (typeof INCUBATION_EVENTS)[number];

export type HatcheryBatch = {
  id: string;
  code: string;
  speciesId: string;
  breedId: string | null;
  setDate: string;
  eggCount: number;
  incubationDays: number;
  expectedHatchDate: string;
  candlingDate: string | null;
  lockdownDate: string | null;
  status: HatchStatus;
  fertileCount: number | null;
  hatchedCount: number | null;
  hatchRate: number;
  fertilityRate: number;
};

export type IncubationLog = {
  id: string;
  event: IncubationEventType;
  occurredAt: string;
  temperatureC: number | null;
  humidityPct: number | null;
  notes?: string | null;
};

export type HatcheryDetail = HatcheryBatch & { incubationLogs: IncubationLog[] };

export function useHatchery() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'hatchery'),
    queryFn: async () =>
      (await fetchJson<{ batches: HatcheryBatch[] }>('/api/farm/hatchery')).batches,
  });
}

export function useHatcheryDetail(id: string | null) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'hatchery', id ?? ''),
    queryFn: async () =>
      (await fetchJson<{ batch: HatcheryDetail }>(`/api/farm/hatchery/${encodeURIComponent(id!)}`)).batch,
    enabled: !!id,
  });
}

export type CreateHatcheryData = {
  speciesId: string;
  breedId?: string;
  code: string;
  setDate: string;
  eggCount: number;
  incubationDays?: number;
};

export function useCreateHatchery() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ batch: HatcheryBatch }, CreateHatcheryData>({
    mutationFn: (data) =>
      fetchJson('/api/farm/hatchery', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'hatchery.added',
    errorKeyByCode: { NO_INCUBATION_DAYS: 'hatchery.noIncubation' },
    invalidate: [farmKeys.list(farmId, 'hatchery')],
  });
}

export type UpdateHatcheryData = {
  status?: HatchStatus;
  hatchedCount?: number;
  fertileCount?: number;
};

export function useUpdateHatchery() {
  const { farmId, fetchJson } = useFarmApi();
  const queryClient = useQueryClient();
  return useApiMutation<{ batch: HatcheryBatch }, { id: string; data: UpdateHatcheryData }>({
    mutationFn: ({ id, data }) =>
      fetchJson(`/api/farm/hatchery/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    successKey: 'hatchery.updated',
    invalidate: [farmKeys.list(farmId, 'hatchery')],
    onSuccess: (_data, { id }) =>
      void queryClient.invalidateQueries({ queryKey: farmKeys.detail(farmId, 'hatchery', id) }),
  });
}

export type AddIncubationLogData = {
  event: IncubationEventType;
  temperatureC?: number;
  humidityPct?: number;
  notes?: string;
};

export function useAddIncubationLog() {
  const { farmId, fetchJson } = useFarmApi();
  const queryClient = useQueryClient();
  return useApiMutation<{ log: IncubationLog }, { id: string; data: AddIncubationLogData }>({
    mutationFn: ({ id, data }) =>
      fetchJson(`/api/farm/hatchery/${encodeURIComponent(id)}/logs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    successKey: 'hatchery.logAdded',
    onSuccess: (_data, { id }) =>
      void queryClient.invalidateQueries({ queryKey: farmKeys.detail(farmId, 'hatchery', id) }),
  });
}
