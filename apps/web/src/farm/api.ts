const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type Unit = {
  id: string;
  name: string;
  type: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
};

export type FarmSettings = {
  timezone: string;
  currency: string;
  defaultLocale: string;
  areaUnit: string;
  fssaiLicenseNo: string | null;
  fssaiTier: string | null;
  gstin: string | null;
  gstThresholdPaise: string | null;
};

async function authed<T>(
  path: string,
  token: string,
  farmId: string | null,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (farmId) headers['X-Farm-Id'] = farmId;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: { code?: string } })?.error?.code ?? 'REQUEST_FAILED');
  return body as T;
}

export const createFarm = (token: string, data: { name: string; state?: string }) =>
  authed<{ farm: { id: string } }>('/api/farms', token, null, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const listUnits = (token: string, farmId: string) =>
  authed<{ units: Unit[] }>('/api/farm/units', token, farmId);

export const createUnit = (token: string, farmId: string, data: { name: string; type: string }) =>
  authed<{ unit: Unit }>('/api/farm/units', token, farmId, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteUnit = (token: string, farmId: string, id: string) =>
  authed<{ ok: true }>(`/api/farm/units/${id}`, token, farmId, { method: 'DELETE' });

export const getSettings = (token: string, farmId: string) =>
  authed<{ settings: FarmSettings }>('/api/farm/settings', token, farmId);

export const updateSettings = (token: string, farmId: string, data: Partial<FarmSettings>) =>
  authed<{ settings: FarmSettings }>('/api/farm/settings', token, farmId, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export type SpeciesSummary = {
  id: string;
  code: string;
  name: string;
  trackingMode: 'INDIVIDUAL' | 'BATCH';
  isSystemDefault: boolean;
};
export type SpeciesDetail = SpeciesSummary & {
  breeds: { id: string; name: string; isSystemDefault: boolean }[];
  stages: { id: string; name: string; sequence: number; isTerminal: boolean }[];
};

export const listSpecies = (token: string, farmId: string) =>
  authed<{ species: SpeciesSummary[] }>('/api/farm/species', token, farmId);

export const getSpecies = (token: string, farmId: string, id: string) =>
  authed<{ species: SpeciesDetail }>(`/api/farm/species/${id}`, token, farmId);

export type Batch = {
  id: string;
  code: string;
  name: string | null;
  initialCount: number;
  currentCount: number;
  status: 'ACTIVE' | 'CLOSED';
  qrCode: string | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  currentStage: { id: string; name: string; sequence: number; isTerminal: boolean } | null;
};

export const listBatches = (token: string, farmId: string) =>
  authed<{ batches: Batch[] }>('/api/farm/batches', token, farmId);

export const createBatch = (
  token: string,
  farmId: string,
  data: { speciesId: string; code: string; initialCount: number; breedId?: string; unitId?: string; name?: string },
) => authed<{ batch: Batch }>('/api/farm/batches', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const advanceBatch = (token: string, farmId: string, id: string) =>
  authed<{ batch: Batch }>(`/api/farm/batches/${id}/advance`, token, farmId, { method: 'POST' });

export const closeBatch = (token: string, farmId: string, id: string) =>
  authed<{ batch: Batch }>(`/api/farm/batches/${id}/close`, token, farmId, { method: 'POST' });

export type Animal = {
  id: string;
  tagNumber: string | null;
  qrCode: string | null;
  name: string | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  dob: string | null;
  status: 'ACTIVE' | 'SOLD' | 'DEAD' | 'CULLED';
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  currentStage: { id: string; name: string; sequence: number; isTerminal: boolean } | null;
};

export const listAnimals = (token: string, farmId: string) =>
  authed<{ animals: Animal[] }>('/api/farm/animals', token, farmId);

export const createAnimal = (
  token: string,
  farmId: string,
  data: { speciesId: string; tagNumber?: string; name?: string; sex?: string; breedId?: string; unitId?: string },
) => authed<{ animal: Animal }>('/api/farm/animals', token, farmId, { method: 'POST', body: JSON.stringify(data) });
