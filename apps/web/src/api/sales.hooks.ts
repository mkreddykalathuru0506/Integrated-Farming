/**
 * TanStack Query hooks for the sales workflow group (slice 11.6d):
 * orders → cold storage → processing/lots → dispatch.
 * Follows the api/hooks.ts exemplar: queries via useFarmApi + farmKeys,
 * mutations via useApiMutation (central toasts + invalidation).
 */
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../lib/useApiMutation';
import { qs } from '../lib/http';
import type {
  ColdStorage,
  Customer,
  Dispatch,
  LotTrace,
  ProductLot,
  SalesOrder,
  TempLog,
} from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

// ---------- Reads ----------

export function useOrders() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'orders'),
    queryFn: async () => (await fetchJson<{ orders: SalesOrder[] }>('/api/farm/orders')).orders,
  });
}

export function useCustomers() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'customers'),
    queryFn: async () =>
      (await fetchJson<{ customers: Customer[] }>('/api/farm/customers')).customers,
  });
}

export function useColdStores() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'coldstorage'),
    queryFn: async () => (await fetchJson<{ stores: ColdStorage[] }>('/api/farm/coldstorage')).stores,
  });
}

/**
 * Temperature history window for one store (default: last 7 days).
 * Passing `from` makes the API return ascending rows — chart-ready.
 */
export function useStoreTemps(storeId: string, days = 7) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'coldtemps', { storeId, days }),
    queryFn: async () => {
      const from = new Date(Date.now() - days * 86_400_000).toISOString();
      const path = `/api/farm/coldstorage/${encodeURIComponent(storeId)}/temps${qs({ from })}`;
      return (await fetchJson<{ temps: TempLog[] }>(path)).temps;
    },
  });
}

export function useLots() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'lots'),
    queryFn: async () => (await fetchJson<{ lots: ProductLot[] }>('/api/farm/lots')).lots,
  });
}

/** Full lot → run → batch → species provenance; fetched when a lot detail opens. */
export function useLotTrace(lotId: string | null) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'lottrace', lotId ?? 'none'),
    queryFn: async () => fetchJson<LotTrace>(`/api/farm/lots/${encodeURIComponent(lotId!)}/trace`),
    enabled: lotId !== null,
  });
}

export function useDispatches() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'dispatches'),
    queryFn: async () =>
      (await fetchJson<{ dispatches: Dispatch[] }>('/api/farm/dispatches')).dispatches,
  });
}

// ---------- Mutations ----------

export type OrderLineInput = {
  description: string;
  qty: number;
  unit?: string;
  unitPricePaise: string;
  batchId?: string;
  productLotId?: string;
};
export type CreateOrderInput = {
  customerId: string;
  expectedDate?: string;
  notes?: string;
  lines: OrderLineInput[];
};

export function useCreateOrder() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ order: SalesOrder }, CreateOrderInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/orders', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'orders.createdToast',
    invalidate: [farmKeys.list(farmId, 'orders')],
  });
}

function useOrderStatus(status: 'CONFIRMED' | 'CANCELLED', successKey: string) {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ order: SalesOrder }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/orders/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    successKey,
    invalidate: [farmKeys.list(farmId, 'orders')],
  });
}

export function useConfirmOrder() {
  return useOrderStatus('CONFIRMED', 'orders.confirmedToast');
}

export function useCancelOrder() {
  return useOrderStatus('CANCELLED', 'orders.cancelledToast');
}

export type CreateColdStoreInput = {
  name: string;
  mode: 'FRESH' | 'FROZEN';
  unitId?: string;
  minTempC?: number;
  maxTempC?: number;
};

export function useCreateColdStore() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ store: ColdStorage }, CreateColdStoreInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/coldstorage', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'cold.createdToast',
    invalidate: [farmKeys.list(farmId, 'coldstorage')],
  });
}

export type RecordTempInput = { storeId: string; temperatureC: number; notes?: string };

/**
 * Temp logging deliberately has NO static successKey: the panel toasts
 * success vs a loud out-of-range warning from the response's isOutOfRange
 * (a silent/ambiguous temp log is a cold-chain compliance hazard).
 * Failure toasts still come from useApiMutation.
 */
export function useRecordTemp() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ temp: TempLog }, RecordTempInput>({
    mutationFn: ({ storeId, ...data }) =>
      fetchJson(`/api/farm/coldstorage/${encodeURIComponent(storeId)}/temps`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    invalidate: [farmKeys.list(farmId, 'coldstorage'), farmKeys.list(farmId, 'coldtemps')],
  });
}

export type ProcessingLotInput = {
  productName: string;
  state: 'FRESH' | 'FROZEN';
  quantityKg: number;
  coldStorageId?: string;
  expiryDate?: string;
};
export type CreateProcessingInput = {
  sourceBatchId: string;
  inputCount?: number;
  processedAt?: string;
  notes?: string;
  lots: ProcessingLotInput[];
};

export function useCreateProcessing() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, CreateProcessingInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/processing', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'processing.createdToast',
    // Processing decrements the source batch count — refresh batches too.
    invalidate: [farmKeys.list(farmId, 'lots'), farmKeys.list(farmId, 'batches')],
  });
}

export type DispatchLineInput = { productLotId: string; qtyKg: number };
export type CreateDispatchInput = {
  salesOrderId: string;
  refrigeratedTransport: boolean;
  dispatchTempC?: number;
  vehicleNumber?: string;
  notes?: string;
  lines: DispatchLineInput[];
};

export function useCreateDispatch() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ dispatch: Dispatch }, CreateDispatchInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/dispatches', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'dispatch.createdToast',
    // Dispatch flips the order to DISPATCHED and decrements lot quantities.
    invalidate: [
      farmKeys.list(farmId, 'dispatches'),
      farmKeys.list(farmId, 'orders'),
      farmKeys.list(farmId, 'lots'),
    ],
  });
}
