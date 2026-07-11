/**
 * Dashboard data layer (slice 11.7) — every read is a TanStack Query via the farm-scoped
 * fetch + farmKeys factory; mutations go through useApiMutation (toasts + invalidation).
 * Colocated here (not api/hooks.ts) per the sweep convention to avoid merge conflicts.
 */
import { useQuery } from '@tanstack/react-query';
import type { AlertLog, ColdStorage, Dashboard, FeedItem, RiskFlag } from '../farm/api';
import { useApiMutation } from '../lib/useApiMutation';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

// ---------- response shapes ----------

export type OnboardingStepKey = 'units' | 'batches' | 'workers' | 'dailyLogs' | 'invoices';
export type Onboarding = {
  steps: Record<OnboardingStepKey, { done: boolean }>;
  completedCount: number;
  total: number;
};

/** GET /api/farm/due?days=7 (the slices the dashboard renders). */
export type DueRollup = {
  counts: { vaccinations: number; maintenance: number; emi: number; insurance: number; tasks: number };
  vaccinations: { batch: { id: string; code: string }; due: { id: string; vaccineName: string; ageDays: number }[] }[];
  maintenance: { id: string; name: string; nextDueDate: string | null; asset: { name: string } }[];
  emiDue: { id: string; lender: string; nextDueDate: string | null }[];
  policiesExpiring: { id: string; provider: string; endDate: string }[];
  tasksToday: { id: string; title: string }[];
};

/** GET /api/farm/finance/summary — money stays integer-paise strings on the wire. */
export type FinanceSummary = {
  granularity: 'month';
  from: string;
  to: string;
  buckets: {
    month: string; // YYYY-MM (IST)
    revenuePaise: string;
    expensePaise: string;
    feedCostPaise: string;
    profitPaise: string;
  }[];
};

export type FinancePeriod = 'month' | 'fy' | 'all';

export type FarmDetail = { id: string; name: string; createdAt: string };

// ---------- queries ----------

export function useDashboard() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'dashboard'),
    queryFn: () => fetchJson<Dashboard>('/api/farm/dashboard'),
  });
}

export function useOpenRiskFlags() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'risk', { status: 'OPEN' }),
    queryFn: async () => (await fetchJson<{ risks: RiskFlag[] }>('/api/farm/risk?status=OPEN')).risks,
  });
}

export function useAlerts() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'alerts'),
    queryFn: async () => (await fetchJson<{ alerts: AlertLog[] }>('/api/farm/alerts')).alerts,
  });
}

export function useFeedItems() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'feed'),
    queryFn: async () => (await fetchJson<{ items: FeedItem[] }>('/api/farm/feed')).items,
  });
}

export function useColdStorages() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'coldstorage'),
    queryFn: async () => (await fetchJson<{ stores: ColdStorage[] }>('/api/farm/coldstorage')).stores,
  });
}

export function useDueRollup(days = 7) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'due', { days }),
    queryFn: () => fetchJson<DueRollup>(`/api/farm/due?days=${days}`),
  });
}

export function useOnboarding() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'onboarding'),
    queryFn: () => fetchJson<Onboarding>('/api/farm/onboarding'),
  });
}

export function useFarmDetail(enabled = true) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'farm', farmId),
    queryFn: async () => (await fetchJson<{ farm: FarmDetail }>('/api/farm')).farm,
    enabled,
  });
}

/** First day of the current month in Asia/Kolkata, as an ISO instant (00:00 IST). */
export function istMonthStart(now = new Date()): string {
  const IST_OFFSET_MS = 330 * 60_000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return new Date(`${y}-${m}-01T00:00:00+05:30`).toISOString();
}

/**
 * "All time" fallback start when the farm's createdAt is unavailable — a fixed
 * early FY boundary, so the query can never be permanently disabled.
 */
export const ALL_TIME_FROM = '2000-04-01T00:00:00+05:30';

/**
 * Finance summary for a period: 'fy' = server default (current Indian FY),
 * 'month' = from the 1st of the current IST month, 'all' = from the farm's
 * creation (falling back to ALL_TIME_FROM so 'all' always fetches — a missing
 * createdAt must never leave the panel on a permanent skeleton).
 */
export function useFinanceSummary(period: FinancePeriod, farmCreatedAt: string | undefined) {
  const { farmId, fetchJson } = useFarmApi();
  const from =
    period === 'month'
      ? istMonthStart()
      : period === 'all'
        ? new Date(farmCreatedAt ?? ALL_TIME_FROM).toISOString()
        : undefined;
  return useQuery({
    queryKey: farmKeys.list(farmId, 'finance-summary', { period, from: from ?? null }),
    queryFn: () =>
      fetchJson<FinanceSummary>(`/api/farm/finance/summary${from ? `?from=${encodeURIComponent(from)}` : ''}`),
  });
}

// ---------- mutations ----------

export function useAcknowledgeRisk() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ risk: RiskFlag }, string>({
    mutationFn: (id) =>
      fetchJson(`/api/farm/risk/${encodeURIComponent(id)}/ack`, { method: 'POST', body: JSON.stringify({}) }),
    successKey: 'dashboard.acked',
    invalidate: [farmKeys.list(farmId, 'risk'), farmKeys.list(farmId, 'dashboard')],
  });
}

export function useDispatchAlerts() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ dispatched: number }, void>({
    mutationFn: () => fetchJson('/api/farm/alerts/dispatch', { method: 'POST', body: JSON.stringify({}) }),
    successKey: 'dashboard.alertsSent',
    invalidate: [farmKeys.list(farmId, 'alerts'), farmKeys.list(farmId, 'dashboard')],
  });
}

/** POST /api/farm/intelligence/sweep — proactive weather+risk refresh (OWNER/MANAGER). */
export function useIntelligenceSweep() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ dispatched: number }, void>({
    mutationFn: () => fetchJson('/api/farm/intelligence/sweep', { method: 'POST', body: JSON.stringify({}) }),
    successKey: 'dashboard.sweepDone',
    invalidate: [
      farmKeys.list(farmId, 'dashboard'),
      farmKeys.list(farmId, 'risk'),
      farmKeys.list(farmId, 'alerts'),
    ],
  });
}
