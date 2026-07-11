/**
 * TanStack Query hooks for the finance group (slice 11.6c): feed inventory,
 * expenses & batch cost, loans/insurance, customers & invoices, P&L.
 * Colocated per the sweep playbook so the shared `hooks.ts` stays conflict-free.
 * Pattern: queries via useFarmApi + farmKeys, mutations via useApiMutation.
 */
import { useQuery } from '@tanstack/react-query';
import { qs, requestBlob } from '../lib/http';
import { usePagedList } from './paged';
import { useApiMutation } from '../lib/useApiMutation';
import type {
  BatchCost,
  Customer,
  Expense,
  Fcr,
  FeedItem,
  FinanceReminders,
  InsurancePolicy,
  Invoice,
  Loan,
  Pnl,
} from '../farm/api';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

// ---------- shared types (list/detail shapes the legacy farm/api.ts lacks) ----------

/** Paged invoice row — the `?page` envelope adds a light customer join. */
export type InvoiceListItem = Invoice & { customer: { id: string; name: string } };

export type InvoiceLine = {
  id: string;
  description: string;
  hsnSac: string | null;
  qty: string;
  unitPricePaise: string;
  gstRateBps: number;
  taxablePaise: string;
  gstPaise: string;
  lineTotalPaise: string;
  batchId: string | null;
};

export type InvoiceDetail = Invoice & {
  customer: Customer;
  placeOfSupplyState: string | null;
  notes: string | null;
  lines: InvoiceLine[];
};

export type FarmInfo = { id: string; name: string; state: string | null; district: string | null };

// ---------- feed ----------

export function useFeedItems() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'feed'),
    queryFn: async () => (await fetchJson<{ items: FeedItem[] }>('/api/farm/feed')).items,
  });
}

export function useFcr(batchId: string | undefined) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'fcr', { batchId: batchId ?? '' }),
    queryFn: async () => fetchJson<Fcr>(`/api/farm/feed/fcr${qs({ batchId: batchId! })}`),
    enabled: Boolean(batchId),
  });
}

export function useCreateFeedItem() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ item: FeedItem }, { name: string; unit?: string; reorderThreshold?: number }>({
    mutationFn: (data) => fetchJson('/api/farm/feed', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'feed.itemAdded',
    invalidate: [farmKeys.list(farmId, 'feed')],
  });
}

export function usePurchaseFeed() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { item: FeedItem; totalPaise: string },
    { feedItemId: string; qty: number; unitPricePaise: string; occurredAt?: string }
  >({
    mutationFn: (data) =>
      fetchJson('/api/farm/feed/purchase', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'feed.purchased',
    invalidate: [farmKeys.list(farmId, 'feed')],
  });
}

export function useConsumeFeed() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { item: FeedItem; costPaise: string | null },
    { feedItemId: string; batchId: string; qty: number; occurredAt?: string }
  >({
    mutationFn: (data) =>
      fetchJson('/api/farm/feed/consume', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'feed.consumed',
    // Consumption changes stock, the batch FCR, batch cost and farm P&L.
    invalidate: [
      farmKeys.list(farmId, 'feed'),
      farmKeys.list(farmId, 'fcr'),
      farmKeys.list(farmId, 'batchCost'),
      farmKeys.list(farmId, 'pnl'),
    ],
  });
}

// ---------- expenses & batch cost ----------

/**
 * Expenses via the server-pagination envelope + "Load more" (slice 11.8a) — the
 * append-only expense table is no longer downloaded whole on every mount.
 */
export function useExpenses(batchId?: string) {
  const { farmId } = useFarmApi();
  return usePagedList<Expense>(
    farmKeys.list(farmId, 'expenses', { batchId: batchId ?? '' }),
    (page, pageSize) => `/api/farm/expenses${qs({ page, pageSize, batchId })}`,
  );
}

export function useBatchCost(batchId: string | undefined) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'batchCost', { batchId: batchId ?? '' }),
    queryFn: async () => fetchJson<BatchCost>(`/api/farm/expenses/batch-cost${qs({ batchId: batchId! })}`),
    enabled: Boolean(batchId),
  });
}

export function useCreateExpense() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { expense: Expense },
    { category: string; amountPaise: string; batchId?: string; description?: string; occurredAt?: string }
  >({
    mutationFn: (data) => fetchJson('/api/farm/expenses', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'expenses.added',
    invalidate: [
      farmKeys.list(farmId, 'expenses'),
      farmKeys.list(farmId, 'batchCost'),
      farmKeys.list(farmId, 'pnl'),
    ],
  });
}

// ---------- loans & insurance ----------

export function useLoans() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'loans'),
    queryFn: async () => (await fetchJson<{ loans: Loan[] }>('/api/farm/loans')).loans,
  });
}

export function useInsurance() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'insurance'),
    queryFn: async () => (await fetchJson<{ policies: InsurancePolicy[] }>('/api/farm/insurance')).policies,
  });
}

export function useFinanceReminders() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'financeReminders'),
    queryFn: async () => fetchJson<FinanceReminders>('/api/farm/finance/reminders'),
  });
}

export function useCreateLoan() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { loan: Loan },
    {
      lender: string;
      principalPaise: string;
      emiAmountPaise?: string;
      interestRateBps?: number;
      tenureMonths?: number;
      startDate: string;
      nextDueDate?: string;
      notes?: string;
    }
  >({
    mutationFn: (data) => fetchJson('/api/farm/loans', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'emi.loanAdded',
    invalidate: [farmKeys.list(farmId, 'loans'), farmKeys.list(farmId, 'financeReminders')],
  });
}

export function useCreateInsurance() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { policy: InsurancePolicy },
    {
      provider: string;
      policyNumber?: string;
      type: string;
      premiumPaise: string;
      sumInsuredPaise?: string;
      startDate: string;
      endDate: string;
      notes?: string;
    }
  >({
    mutationFn: (data) => fetchJson('/api/farm/insurance', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'emi.policyAdded',
    invalidate: [farmKeys.list(farmId, 'insurance'), farmKeys.list(farmId, 'financeReminders')],
  });
}

// ---------- customers, invoices & P&L ----------

export function useCustomers() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'customers'),
    queryFn: async () => (await fetchJson<{ customers: Customer[] }>('/api/farm/customers')).customers,
  });
}

/**
 * Invoice list via the paged envelope + "Load more" (slice 11.8a). Older invoices
 * (#101+) are no longer silently invisible: the first page loads, `total` is
 * surfaced, and additional pages are appended on demand.
 */
export function useInvoices() {
  const { farmId } = useFarmApi();
  return usePagedList<InvoiceListItem>(
    farmKeys.list(farmId, 'invoices'),
    (page, pageSize) => `/api/farm/invoices${qs({ page, pageSize })}`,
  );
}

export function useInvoice(id: string | null) {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.detail(farmId, 'invoices', id ?? ''),
    queryFn: async () =>
      (await fetchJson<{ invoice: InvoiceDetail }>(`/api/farm/invoices/${encodeURIComponent(id!)}`)).invoice,
    enabled: Boolean(id),
  });
}

export function useFarmPnl() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'pnl'),
    queryFn: async () => fetchJson<Pnl>('/api/farm/invoices/pnl/farm'),
  });
}

/** Farm record (state drives the CGST/SGST vs IGST preview split). */
export function useFarmInfo() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'farmInfo'),
    queryFn: async () => (await fetchJson<{ farm: FarmInfo }>('/api/farm')).farm,
  });
}

export function useCreateCustomer() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { customer: Customer },
    { name: string; gstin?: string; state?: string; phone?: string; address?: string }
  >({
    mutationFn: (data) => fetchJson('/api/farm/customers', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'invoices.customerAdded',
    invalidate: [farmKeys.list(farmId, 'customers')],
  });
}

export type CreateInvoiceLine = {
  description: string;
  qty: number;
  unitPricePaise: string; // integer-paise string passthrough — never floats
  gstRateBps: number;
  batchId?: string;
};

export function useCreateInvoice() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<
    { invoice: Invoice },
    { customerId: string; issueDate?: string; notes?: string; lines: CreateInvoiceLine[] }
  >({
    mutationFn: (data) => fetchJson('/api/farm/invoices', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'invoices.raised',
    invalidate: [farmKeys.list(farmId, 'invoices'), farmKeys.list(farmId, 'pnl')],
  });
}

/**
 * Fetch the invoice PDF (auth injected by the fetch delegate) and open it in a
 * new tab. As a mutation so ApiError surfaces through the standard error toast.
 */
export function useOpenInvoicePdf() {
  const { farmId } = useFarmApi();
  return useApiMutation<void, string>({
    mutationFn: async (id) => {
      const blob = await requestBlob(`/api/farm/invoices/${encodeURIComponent(id)}/pdf`, { farmId });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
  });
}
