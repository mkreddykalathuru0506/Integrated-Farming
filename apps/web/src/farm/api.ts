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
  latitude: number | null;
  longitude: number | null;
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

export type HatcheryBatch = {
  id: string;
  code: string;
  speciesId: string;
  setDate: string;
  eggCount: number;
  incubationDays: number;
  expectedHatchDate: string;
  candlingDate: string | null;
  lockdownDate: string | null;
  status: string;
  hatchedCount: number | null;
  fertileCount: number | null;
  hatchRate: number;
  fertilityRate: number;
};

export const listHatchery = (token: string, farmId: string) =>
  authed<{ batches: HatcheryBatch[] }>('/api/farm/hatchery', token, farmId);

export const createHatchery = (
  token: string,
  farmId: string,
  data: { speciesId: string; code: string; setDate: string; eggCount: number },
) => authed<{ batch: HatcheryBatch }>('/api/farm/hatchery', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const updateHatchery = (
  token: string,
  farmId: string,
  id: string,
  data: { status?: string; hatchedCount?: number; fertileCount?: number },
) => authed<{ batch: HatcheryBatch }>(`/api/farm/hatchery/${id}`, token, farmId, { method: 'PATCH', body: JSON.stringify(data) });

export type FeedItem = {
  id: string;
  name: string;
  unit: string;
  stockQty: string;
  reorderThreshold: string | null;
  lastUnitPricePaise: string | null;
};

export const listFeedItems = (token: string, farmId: string) =>
  authed<{ items: FeedItem[] }>('/api/farm/feed', token, farmId);

export const createFeedItem = (
  token: string,
  farmId: string,
  data: { name: string; unit?: string; reorderThreshold?: number },
) => authed<{ item: FeedItem }>('/api/farm/feed', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const purchaseFeed = (
  token: string,
  farmId: string,
  data: { feedItemId: string; qty: number; unitPricePaise: string },
) => authed('/api/farm/feed/purchase', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const consumeFeed = (
  token: string,
  farmId: string,
  data: { feedItemId: string; batchId: string; qty: number },
) => authed('/api/farm/feed/consume', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type Fcr = { feedConsumedKg: number; weightGainKg: number; feedCostPaise: string; fcr: number | null };

export const getFcr = (token: string, farmId: string, batchId: string) =>
  authed<Fcr>(`/api/farm/feed/fcr?batchId=${batchId}`, token, farmId);

export type Expense = {
  id: string;
  category: string;
  amountPaise: string;
  occurredAt: string;
  batchId: string | null;
  description: string | null;
};
export type BatchCost = { totalPaise: string; costPerBirdPaise: string; currentCount: number; byCategory: Record<string, string> };

export const listExpenses = (token: string, farmId: string, batchId?: string) =>
  authed<{ expenses: Expense[] }>(`/api/farm/expenses${batchId ? `?batchId=${batchId}` : ''}`, token, farmId);

export const createExpense = (
  token: string,
  farmId: string,
  data: { category: string; amountPaise: string; batchId?: string; description?: string },
) => authed<{ expense: Expense }>('/api/farm/expenses', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const getBatchCost = (token: string, farmId: string, batchId: string) =>
  authed<BatchCost>(`/api/farm/expenses/batch-cost?batchId=${batchId}`, token, farmId);

export type Loan = {
  id: string;
  lender: string;
  principalPaise: string;
  emiAmountPaise: string | null;
  startDate: string;
  nextDueDate: string | null;
  status: string;
};
export type InsurancePolicy = {
  id: string;
  provider: string;
  type: string;
  premiumPaise: string;
  endDate: string;
  status: string;
  policyNumber: string | null;
};
export type FinanceReminders = { emiDue: Loan[]; policiesExpiring: InsurancePolicy[] };

export const listLoans = (token: string, farmId: string) =>
  authed<{ loans: Loan[] }>('/api/farm/loans', token, farmId);
export const createLoan = (
  token: string,
  farmId: string,
  data: { lender: string; principalPaise: string; emiAmountPaise?: string; startDate: string; nextDueDate?: string },
) => authed<{ loan: Loan }>('/api/farm/loans', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const listInsurance = (token: string, farmId: string) =>
  authed<{ policies: InsurancePolicy[] }>('/api/farm/insurance', token, farmId);
export const createInsurance = (
  token: string,
  farmId: string,
  data: { provider: string; type: string; premiumPaise: string; startDate: string; endDate: string },
) => authed<{ policy: InsurancePolicy }>('/api/farm/insurance', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const financeReminders = (token: string, farmId: string) =>
  authed<FinanceReminders>('/api/farm/finance/reminders', token, farmId);

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type Customer = { id: string; name: string; gstin: string | null; state: string | null };
export type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  subtotalPaise: string;
  cgstPaise: string;
  sgstPaise: string;
  igstPaise: string;
  totalPaise: string;
  fssaiLicenseNo: string | null;
};
export type Pnl = { revenuePaise: string; costPaise: string; profitPaise: string };

export const listCustomers = (token: string, farmId: string) =>
  authed<{ customers: Customer[] }>('/api/farm/customers', token, farmId);
export const createCustomer = (token: string, farmId: string, data: { name: string; state?: string; gstin?: string }) =>
  authed<{ customer: Customer }>('/api/farm/customers', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const listInvoices = (token: string, farmId: string) =>
  authed<{ invoices: Invoice[] }>('/api/farm/invoices', token, farmId);
export const createInvoice = (
  token: string,
  farmId: string,
  data: { customerId: string; lines: { description: string; qty: number; unitPricePaise: string; gstRateBps: number; batchId?: string }[] },
) => authed<{ invoice: Invoice }>('/api/farm/invoices', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const farmPnl = (token: string, farmId: string) =>
  authed<Pnl>('/api/farm/invoices/pnl/farm', token, farmId);

/** Fetch the invoice PDF (auth + farm header) and open it in a new tab. */
export async function openInvoicePdf(token: string, farmId: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/farm/invoices/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Farm-Id': farmId },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ---------- Sales orders (Phase 5) ----------
export type OrderLine = {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitPricePaise: string;
  lineTotalPaise: string;
  batchId: string | null;
  productLotId: string | null;
};
export type SalesOrder = {
  id: string;
  orderNumber: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  orderDate: string;
  expectedDate: string | null;
  totalPaise: string;
  notes: string | null;
  customer: { id: string; name: string; state: string | null };
  lines: OrderLine[];
};

export const listOrders = (token: string, farmId: string) =>
  authed<{ orders: SalesOrder[] }>('/api/farm/orders', token, farmId);

export const createOrder = (
  token: string,
  farmId: string,
  data: {
    customerId: string;
    lines: { description: string; qty: number; unit?: string; unitPricePaise: string; batchId?: string; productLotId?: string }[];
  },
) => authed<{ order: SalesOrder }>('/api/farm/orders', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const setOrderStatus = (token: string, farmId: string, id: string, status: 'CONFIRMED' | 'CANCELLED') =>
  authed<{ order: SalesOrder }>(`/api/farm/orders/${id}/status`, token, farmId, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// ---------- Cold storage (Phase 5) ----------
export type ColdStorage = {
  id: string;
  name: string;
  mode: 'FRESH' | 'FROZEN';
  minTempC: number;
  maxTempC: number;
  isActive: boolean;
  latest: { temperatureC: number; isOutOfRange: boolean; recordedAt: string } | null;
  breachCount: number;
};
export type TempLog = {
  id: string;
  temperatureC: number;
  isOutOfRange: boolean;
  recordedAt: string;
  source: string | null;
  notes?: string | null;
};

export const listColdStorages = (token: string, farmId: string) =>
  authed<{ stores: ColdStorage[] }>('/api/farm/coldstorage', token, farmId);

export const createColdStorage = (token: string, farmId: string, data: { name: string; mode: 'FRESH' | 'FROZEN' }) =>
  authed<{ store: ColdStorage }>('/api/farm/coldstorage', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const recordTemp = (token: string, farmId: string, id: string, data: { temperatureC: number }) =>
  authed<{ temp: TempLog }>(`/api/farm/coldstorage/${id}/temps`, token, farmId, { method: 'POST', body: JSON.stringify(data) });

// ---------- Processing → lots + traceability (Phase 5) ----------
export type ProductLot = {
  id: string;
  lotCode: string;
  qrCode: string | null;
  productName: string;
  state: 'FRESH' | 'FROZEN';
  initialQuantityKg: string;
  quantityKg: string;
  status: 'AVAILABLE' | 'DEPLETED' | 'DISCARDED';
  producedAt: string;
  expiryDate: string | null;
  coldStorageId: string | null;
  sourceBatchId: string | null;
  sourceBatch?: { id: string; code: string; species: { name: string } } | null;
  coldStorage?: { id: string; name: string } | null;
};

export type LotTrace = {
  lot: { id: string; lotCode: string; productName: string; state: string; quantityKg: string; producedAt: string };
  coldStorage: { id: string; name: string; mode: string } | null;
  processingRun: { id: string; processedAt: string; inputCount: number | null } | null;
  sourceBatch: {
    id: string;
    code: string;
    qrCode: string | null;
    species: { id: string; name: string };
    breed: { id: string; name: string } | null;
  } | null;
};

export const listLots = (token: string, farmId: string) =>
  authed<{ lots: ProductLot[] }>('/api/farm/lots', token, farmId);

export const traceLot = (token: string, farmId: string, id: string) =>
  authed<LotTrace>(`/api/farm/lots/${id}/trace`, token, farmId);

export const createProcessing = (
  token: string,
  farmId: string,
  data: {
    sourceBatchId?: string;
    sourceAnimalId?: string;
    inputCount?: number;
    lots: { productName: string; state?: 'FRESH' | 'FROZEN'; quantityKg: number; coldStorageId?: string }[];
  },
) => authed('/api/farm/processing', token, farmId, { method: 'POST', body: JSON.stringify(data) });

// ---------- Dispatch w/ cold-chain (Phase 5) ----------
export type DispatchLineView = {
  id: string;
  qtyKg: string | null;
  count: number | null;
  batchId: string | null;
  productLot: {
    id: string;
    lotCode: string;
    productName: string;
    state: 'FRESH' | 'FROZEN';
    sourceBatch: { id: string; code: string; species: { name: string } } | null;
  } | null;
};
export type Dispatch = {
  id: string;
  dispatchedAt: string;
  refrigeratedTransport: boolean;
  vehicleNumber: string | null;
  dispatchTempC: number | null;
  coldChainOk: boolean;
  salesOrder: { id: string; orderNumber: string; status: string };
  lines: DispatchLineView[];
};

export const listDispatches = (token: string, farmId: string) =>
  authed<{ dispatches: Dispatch[] }>('/api/farm/dispatches', token, farmId);

export const createDispatch = (
  token: string,
  farmId: string,
  data: {
    salesOrderId: string;
    refrigeratedTransport?: boolean;
    dispatchTempC?: number;
    vehicleNumber?: string;
    lines: { productLotId?: string; batchId?: string; qtyKg?: number; count?: number }[];
  },
) => authed<{ dispatch: Dispatch }>('/api/farm/dispatches', token, farmId, { method: 'POST', body: JSON.stringify(data) });

// ---------- Assets & maintenance (Phase 6) ----------
export type MaintSchedule = { id: string; name: string; intervalDays: number; nextDueDate: string; isActive: boolean };
export type Asset = {
  id: string;
  name: string;
  type: string;
  code: string | null;
  status: string;
  purchaseDate: string | null;
  purchaseCostPaise: string | null;
  schedules: MaintSchedule[];
};
export type MaintReminder = { id: string; name: string; nextDueDate: string; asset: { id: string; name: string } };

export const listAssets = (token: string, farmId: string) =>
  authed<{ assets: Asset[] }>('/api/farm/assets', token, farmId);

export const createAsset = (
  token: string,
  farmId: string,
  data: { name: string; type?: string; purchaseCostPaise?: string },
) => authed<{ asset: Asset }>('/api/farm/assets', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const createMaintenanceSchedule = (
  token: string,
  farmId: string,
  assetId: string,
  data: { name: string; intervalDays: number; nextDueDate: string },
) => authed<{ schedule: MaintSchedule }>(`/api/farm/assets/${assetId}/schedules`, token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const recordMaintenance = (
  token: string,
  farmId: string,
  assetId: string,
  data: { scheduleId?: string; type?: string; costPaise?: string; vendor?: string },
) => authed(`/api/farm/assets/${assetId}/maintenance`, token, farmId, { method: 'POST', body: JSON.stringify(data) });

export const maintenanceReminders = (token: string, farmId: string) =>
  authed<{ due: MaintReminder[] }>('/api/farm/assets/reminders', token, farmId);

// ---------- Byproducts & circularity (Phase 6) ----------
export type ByproductTransfer = {
  id: string;
  byproductType: string;
  fromUnitId: string | null;
  toUnitId: string | null;
  sourceBatchId: string | null;
  quantity: string;
  unit: string;
  creditPaise: string;
  transferredAt: string;
  notes: string | null;
};

export const listByproducts = (token: string, farmId: string) =>
  authed<{ transfers: ByproductTransfer[] }>('/api/farm/byproducts', token, farmId);

export const createByproductTransfer = (
  token: string,
  farmId: string,
  data: { byproductType: string; fromUnitId?: string; toUnitId?: string; quantity: number; unit?: string; creditPaise?: string },
) => authed<{ transfer: ByproductTransfer }>('/api/farm/byproducts', token, farmId, { method: 'POST', body: JSON.stringify(data) });

export type Circularity = {
  totalCreditPaise: string;
  totalQuantity: number;
  transferCount: number;
  byType: { type: string; creditPaise: string; quantity: number; count: number }[];
  byDestination: { unitId: string | null; unitName: string | null; creditPaise: string; count: number }[];
};

export const getCircularity = (token: string, farmId: string) =>
  authed<Circularity>('/api/farm/byproducts/circularity', token, farmId);

// ---------- Intelligence: weather + risk (Phase 7) ----------
export type Weather = {
  weather: { tempC: number; humidityPct: number | null; condition: string | null; source: string; observedAt: string; fetchedAt: string };
  cached?: boolean;
  risk?: { atRisk: boolean; severity: string; reason: string };
};
export type RiskFlag = {
  id: string;
  type: string;
  severity: string;
  reason: string;
  status: string;
  source: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
};

export const getWeather = (token: string, farmId: string, refresh = false) =>
  authed<Weather>(`/api/farm/weather${refresh ? '?refresh=1' : ''}`, token, farmId);

export const listRisks = (token: string, farmId: string, status?: string) =>
  authed<{ risks: RiskFlag[] }>(`/api/farm/risk${status ? `?status=${status}` : ''}`, token, farmId);

export const acknowledgeRisk = (token: string, farmId: string, id: string) =>
  authed<{ risk: RiskFlag }>(`/api/farm/risk/${id}/ack`, token, farmId, { method: 'POST', body: JSON.stringify({}) });
