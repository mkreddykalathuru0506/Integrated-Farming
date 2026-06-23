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

export const recordMortality = (
  token: string,
  farmId: string,
  data: { animalId?: string; batchId?: string; type: 'MORTALITY' | 'CULL'; count?: number; cause?: string },
) => authed('/api/farm/mortality', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const recordMovement = (
  token: string,
  farmId: string,
  data: { animalId?: string; batchId?: string; toUnitId: string },
) => authed('/api/farm/movements', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type Worker = {
  id: string;
  name: string;
  phone: string | null;
  designation: string | null;
  wageType: string;
  dailyWageRatePaise: string | null;
  isActive: boolean;
  userId: string | null;
};
export type AttendanceRow = { id: string; workerId: string; date: string; status: string; notes: string | null };

export const listWorkers = (token: string, farmId: string) =>
  authed<{ workers: Worker[] }>('/api/farm/workers', token, farmId);

export const createWorker = (
  token: string,
  farmId: string,
  data: { name: string; designation?: string; wageType?: string; dailyWageRatePaise?: string },
) => authed<{ worker: Worker }>('/api/farm/workers', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const listAttendance = (token: string, farmId: string, date: string) =>
  authed<{ attendance: AttendanceRow[] }>(`/api/farm/attendance?date=${date}`, token, farmId);

export const markAttendance = (
  token: string,
  farmId: string,
  data: { workerId: string; date: string; status: string },
) => authed('/api/farm/attendance', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type Task = {
  id: string;
  title: string;
  taskType: string;
  dueDate: string;
  status: string;
  completedAt: string | null;
  templateId: string | null;
};
export type Schedule = { id: string; name: string; taskType: string; frequency: string; isActive: boolean };

export const listTasks = (token: string, farmId: string, date: string) =>
  authed<{ tasks: Task[] }>(`/api/farm/tasks?date=${date}`, token, farmId);

export const generateTasks = (token: string, farmId: string, date: string) =>
  authed<{ generated: number; missed: number }>(`/api/farm/tasks/generate?date=${date}`, token, farmId, { method: 'POST' });

export const completeTask = (token: string, farmId: string, id: string) =>
  authed<{ task: Task }>(`/api/farm/tasks/${id}/complete`, token, farmId, { method: 'POST', body: JSON.stringify({}) });

export const listSchedules = (token: string, farmId: string) =>
  authed<{ schedules: Schedule[] }>('/api/farm/schedules', token, farmId);

export const createSchedule = (
  token: string,
  farmId: string,
  data: { name: string; taskType: string; frequency: string },
) => authed<{ schedule: Schedule }>('/api/farm/schedules', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type DailyLog = {
  id: string;
  type: string;
  quantity: number;
  unit: string;
  loggedAt: string;
  batchId: string | null;
  clientLogId: string | null;
};

export const listLogs = (token: string, farmId: string, type?: string) =>
  authed<{ logs: DailyLog[] }>(`/api/farm/logs${type ? `?type=${type}` : ''}`, token, farmId);

export const createLog = (
  token: string,
  farmId: string,
  data: { type: string; batchId?: string; quantity: number; unit: string; clientLogId?: string },
) => authed<{ log: DailyLog }>('/api/farm/logs', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type WithdrawalStatus = { underWithdrawal: boolean; until: string | null };

export const getWithdrawal = (token: string, farmId: string, batchId: string) =>
  authed<WithdrawalStatus>(`/api/farm/health/withdrawal?batchId=${batchId}`, token, farmId);

export const recordMedication = (
  token: string,
  farmId: string,
  data: { batchId: string; drugName: string; withdrawalDays: number },
) => authed('/api/farm/health/medications', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const markSaleReady = (token: string, farmId: string, data: { batchId: string }) =>
  authed<{ result: { saleReadyAt: string } }>('/api/farm/health/sale-ready', token, farmId, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export type VaxItem = { id: string; vaccineName: string; type: string; ageDays: number };
export type Vaccinations = { ageDays: number; due: VaxItem[]; upcoming: VaxItem[]; done: VaxItem[] };

export const getVaccinations = (token: string, farmId: string, batchId: string) =>
  authed<Vaccinations>(`/api/farm/health/vaccinations?batchId=${batchId}`, token, farmId);

export const recordVaccination = (token: string, farmId: string, data: { batchId: string; vaccineName: string }) =>
  authed('/api/farm/health/vaccinations', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type BreedingRecord = {
  id: string;
  speciesId: string | null;
  method: string | null;
  breedingDate: string;
  expectedDueDate: string | null;
  status: string;
  offspringCount: number | null;
};

export const listBreeding = (token: string, farmId: string) =>
  authed<{ records: BreedingRecord[] }>('/api/farm/breeding', token, farmId);

export const createBreeding = (
  token: string,
  farmId: string,
  data: { speciesId?: string; method?: string; breedingDate: string },
) => authed<{ record: BreedingRecord }>('/api/farm/breeding', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const updateBreeding = (
  token: string,
  farmId: string,
  id: string,
  data: { status?: string; offspringCount?: number },
) => authed<{ record: BreedingRecord }>(`/api/farm/breeding/${id}`, token, farmId, { method: 'PATCH', body: JSON.stringify(data) });
