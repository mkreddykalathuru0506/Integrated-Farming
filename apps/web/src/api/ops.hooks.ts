/**
 * TanStack Query hooks for the "ops" sweep group (slice 11.6e):
 * assets & maintenance, byproducts & circularity, weather & risks, market rates,
 * reports, farm settings and farm creation. Same pattern as api/hooks.ts —
 * queries via useFarmApi + farmKeys, mutations via useApiMutation.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request, requestBlob } from '../lib/http';
import { useApiMutation } from '../lib/useApiMutation';
import type {
  Asset,
  ByproductTransfer,
  Circularity,
  FarmSettings,
  MaintReminder,
  MarketRate,
  ReportSchedule,
  RiskFlag,
  Weather,
} from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

/* ---------- assets & maintenance ---------- */

export function useAssets() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'assets'),
    queryFn: async () => (await fetchJson<{ assets: Asset[] }>('/api/farm/assets')).assets,
  });
}

export function useMaintenanceReminders() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'asset-reminders'),
    queryFn: async () => (await fetchJson<{ due: MaintReminder[] }>('/api/farm/assets/reminders')).due,
  });
}

export type CreateAssetInput = {
  name: string;
  type: string;
  purchaseDate?: string;
  purchaseCostPaise?: string;
};

export function useCreateAsset() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ asset: Asset }, CreateAssetInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/assets', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'assets.created',
    invalidate: [farmKeys.list(farmId, 'assets')],
  });
}

export type CreateMaintScheduleInput = {
  assetId: string;
  data: { name: string; intervalDays: number; nextDueDate: string };
};

export function useCreateMaintSchedule() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, CreateMaintScheduleInput>({
    mutationFn: ({ assetId, data }) =>
      fetchJson(`/api/farm/assets/${encodeURIComponent(assetId)}/schedules`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    successKey: 'assets.scheduled',
    invalidate: [farmKeys.list(farmId, 'assets'), farmKeys.list(farmId, 'asset-reminders')],
  });
}

export type RecordMaintenanceInput = {
  assetId: string;
  data: { scheduleId: string; type: string; costPaise?: string; vendor?: string };
};

export function useRecordMaintenance() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, RecordMaintenanceInput>({
    mutationFn: ({ assetId, data }) =>
      fetchJson(`/api/farm/assets/${encodeURIComponent(assetId)}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    successKey: 'assets.serviced',
    invalidate: [farmKeys.list(farmId, 'assets'), farmKeys.list(farmId, 'asset-reminders')],
  });
}

/* ---------- byproducts & circularity ---------- */

export function useByproducts() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'byproducts'),
    queryFn: async () =>
      (await fetchJson<{ transfers: ByproductTransfer[] }>('/api/farm/byproducts')).transfers,
  });
}

export function useCircularity() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'circularity'),
    queryFn: () => fetchJson<Circularity>('/api/farm/byproducts/circularity'),
  });
}

export type CreateByproductInput = {
  byproductType: string;
  fromUnitId?: string;
  toUnitId?: string;
  sourceBatchId?: string;
  quantity: number;
  unit?: string;
  creditPaise?: string;
};

export function useCreateByproduct() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ transfer: ByproductTransfer }, CreateByproductInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/byproducts', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'byproducts.created',
    invalidate: [farmKeys.list(farmId, 'byproducts'), farmKeys.list(farmId, 'circularity')],
  });
}

/* ---------- weather & risks ---------- */

export function useWeather() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'weather'),
    queryFn: () => fetchJson<Weather>('/api/farm/weather'),
    // LOCATION_REQUIRED (422) and other 4xx are stable — retrying can't help.
    retry: false,
  });
}

export function useRefreshWeather() {
  const { farmId, fetchJson } = useFarmApi();
  const queryClient = useQueryClient();
  return useApiMutation<Weather, void>({
    mutationFn: () => fetchJson<Weather>('/api/farm/weather?refresh=1'),
    successKey: 'weather.refreshed',
    errorKeyByCode: { LOCATION_REQUIRED: 'weather.needLocation' },
    // A forced fetch can raise a heat-stress flag — refresh the alerts list too.
    invalidate: [farmKeys.list(farmId, 'risks')],
    onSuccess: (data) => {
      // The fresh response carries `risk`; a plain invalidate would refetch the
      // cached (risk-less) reading, so write it into the query cache directly.
      queryClient.setQueryData(farmKeys.list(farmId, 'weather'), data);
    },
  });
}

export function useOpenRiskFlags() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'risks', { status: 'OPEN' }),
    queryFn: async () =>
      (await fetchJson<{ risks: RiskFlag[] }>('/api/farm/risk?status=OPEN')).risks,
  });
}

export function useAckRisk() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<unknown, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/risk/${encodeURIComponent(id)}/ack`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    successKey: 'weather.acked',
    invalidate: [farmKeys.list(farmId, 'risks')],
  });
}

/* ---------- market rates ---------- */

export function useMarketRates() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'market'),
    queryFn: async () => (await fetchJson<{ rates: MarketRate[] }>('/api/farm/market')).rates,
  });
}

export function useMarketHistory(commodity: string) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'market-history', { commodity }),
    queryFn: async () =>
      (
        await fetchJson<{ rates: MarketRate[] }>(
          `/api/farm/market/history?commodity=${encodeURIComponent(commodity)}`,
        )
      ).rates,
    enabled: commodity !== '',
  });
}

export type PriceRisk = { atRisk: boolean; severity?: string; reason: string };
export type RecordRateInput = { commodity: string; market?: string; pricePaise: string; unit: string };

export function useRecordRate() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ rate: MarketRate; risk?: PriceRisk }, RecordRateInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/market', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'market.saved',
    invalidate: [farmKeys.list(farmId, 'market'), farmKeys.list(farmId, 'market-history')],
  });
}

export function useRefreshRate() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ rate: MarketRate; risk?: PriceRisk }, { commodity: string; market?: string }>({
    mutationFn: (data) =>
      fetchJson('/api/farm/market/refresh', { method: 'POST', body: JSON.stringify(data) }),
    invalidate: [
      farmKeys.list(farmId, 'market'),
      farmKeys.list(farmId, 'market-history'),
      farmKeys.list(farmId, 'risks'),
    ],
  });
}

/* ---------- reports ---------- */

export function useReportSchedules() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'report-schedules'),
    queryFn: async () =>
      (await fetchJson<{ schedules: ReportSchedule[] }>('/api/farm/reports/schedules')).schedules,
  });
}

export type CreateReportScheduleInput = {
  name: string;
  frequency: string;
  format: string;
  channel: string;
  recipient: string;
};

export function useCreateReportSchedule() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ schedule: ReportSchedule }, CreateReportScheduleInput>({
    mutationFn: (data) =>
      fetchJson('/api/farm/reports/schedules', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'reports.added',
    invalidate: [farmKeys.list(farmId, 'report-schedules')],
  });
}

export function useRunReportSchedule() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ delivered: boolean }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/reports/schedules/${encodeURIComponent(id)}/run`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    successKey: 'reports.ran',
    invalidate: [farmKeys.list(farmId, 'report-schedules')],
  });
}

/** Binary summary download; auth comes from the installed fetch delegate. */
export function useDownloadReport() {
  const { farmId } = useFarmApi();
  return useApiMutation<void, 'pdf' | 'xlsx'>({
    mutationFn: async (format) => {
      const blob = await requestBlob(`/api/farm/reports/summary.${format}`, { farmId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `farm-summary.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
    successKey: 'reports.downloaded',
  });
}

/* ---------- farm settings ---------- */

export function useFarmSettings() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'settings'),
    queryFn: async () => (await fetchJson<{ settings: FarmSettings }>('/api/farm/settings')).settings,
  });
}

export type SettingsPatch = {
  fssaiLicenseNo: string | null;
  fssaiTier: string | null;
  gstin: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function useSaveSettings() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ settings: FarmSettings }, SettingsPatch>({
    mutationFn: (data) =>
      fetchJson('/api/farm/settings', { method: 'PUT', body: JSON.stringify(data) }),
    successKey: 'settings.saved',
    invalidate: [
      farmKeys.list(farmId, 'settings'),
      // location powers the weather panel — let it retry once coordinates exist
      farmKeys.list(farmId, 'weather'),
    ],
  });
}

/* ---------- farm creation (pre-farm scope — no FarmProvider available) ---------- */

export function useCreateFarm() {
  return useApiMutation<{ farm: { id: string } }, { name: string; state?: string }>({
    mutationFn: (data) => request('/api/farms', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'farm.create.created',
  });
}
