import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import type { Role } from '../components/nav';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { Dashboard } from './Dashboard';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Asha' } }),
}));

const dash = {
  risks: { open: 1, bySeverity: { CRITICAL: 1 } },
  alerts: { total: 0 },
  weather: { tempC: 38, humidityPct: 70, source: 'mock', fetchedAt: '2026-07-11T05:30:00.000Z' },
  market: [],
};

const due = {
  counts: { vaccinations: 1, maintenance: 0, emi: 1, insurance: 0, tasks: 1 },
  vaccinations: [{ batch: { id: 'b1', code: 'B-001' }, due: [{ id: 'v1', vaccineName: 'Ranikhet', ageDays: 7 }] }],
  maintenance: [],
  emiDue: [{ id: 'l1', lender: 'SBI', nextDueDate: '2026-07-15T00:00:00.000Z' }],
  policiesExpiring: [],
  tasksToday: [{ id: 't1', title: 'Feed morning ration' }],
};

const emptyDue = {
  counts: { vaccinations: 0, maintenance: 0, emi: 0, insurance: 0, tasks: 0 },
  vaccinations: [],
  maintenance: [],
  emiDue: [],
  policiesExpiring: [],
  tasksToday: [],
};

const onboarding = {
  steps: {
    units: { done: true },
    batches: { done: false },
    workers: { done: false },
    dailyLogs: { done: false },
    invoices: { done: false },
  },
  completedCount: 1,
  total: 5,
};

const summary = {
  granularity: 'month',
  from: '2026-04-01T00:00:00.000Z',
  to: '2026-07-11T00:00:00.000Z',
  buckets: [
    { month: '2026-07', revenuePaise: '500000', expensePaise: '150000', feedCostPaise: '50000', profitPaise: '300000' },
  ],
};

function routes(overrides: Record<string, RouteHandler> = {}) {
  return {
    '/api/farm/dashboard': () => jsonResponse(200, dash),
    '/api/farm/risk': () => jsonResponse(200, { risks: [] }),
    '/api/farm/alerts': () => jsonResponse(200, { alerts: [] }),
    '/api/farm/batches': () => jsonResponse(200, { batches: [] }),
    '/api/farm/feed': () => jsonResponse(200, { items: [] }),
    '/api/farm/coldstorage': () => jsonResponse(200, { stores: [] }),
    '/api/farm/due': () => jsonResponse(200, due),
    '/api/farm/onboarding': () => jsonResponse(200, onboarding),
    '/api/farm': () => jsonResponse(200, { farm: { id: 'f1', name: 'Demo', createdAt: '2026-01-01T00:00:00.000Z' } }),
    '/api/farm/finance/summary': () => jsonResponse(200, summary),
    ...overrides,
  };
}

function renderDash(role: Role = 'OWNER') {
  const canWrite = role === 'OWNER' || role === 'MANAGER';
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <Dashboard farmId="f1" canWrite={canWrite} role={role} />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const blockOrder = () =>
  Array.from(document.querySelectorAll('[data-block]')).map((el) => el.getAttribute('data-block'));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Dashboard onboarding checklist', () => {
  it('renders steps with done state, progress and deep-link CTAs', async () => {
    mockFetchRoutes(routes());
    renderDash('OWNER');

    expect(await screen.findByText('Set up your farm')).toBeInTheDocument();
    expect(screen.getByText('1 of 5 done')).toBeInTheDocument();
    expect(screen.getByText('Add a shed or unit')).toBeInTheDocument(); // done — no CTA
    expect(screen.getByText('Add your first batch')).toBeInTheDocument();

    const ctas = screen.getAllByRole('link', { name: 'Set up' });
    expect(ctas).toHaveLength(4); // 4 pending steps
    expect(ctas.map((a) => a.getAttribute('href'))).toEqual([
      '/livestock/batches',
      '/daily/workers',
      '/daily/logs',
      '/finance/invoices',
    ]);
  });

  it('dismiss hides the card and persists per farm in localStorage', async () => {
    mockFetchRoutes(routes());
    renderDash('OWNER');
    expect(await screen.findByText('Set up your farm')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss setup checklist' }));
    await waitFor(() => expect(screen.queryByText('Set up your farm')).not.toBeInTheDocument());
    expect(localStorage.getItem('ifm.onboarding.dismissed.f1')).toBe('1');
  });

  it('is auto-hidden at 100% completion', async () => {
    mockFetchRoutes(
      routes({
        '/api/farm/onboarding': () =>
          jsonResponse(200, {
            steps: {
              units: { done: true },
              batches: { done: true },
              workers: { done: true },
              dailyLogs: { done: true },
              invoices: { done: true },
            },
            completedCount: 5,
            total: 5,
          }),
      }),
    );
    renderDash('OWNER');
    expect(await screen.findByText('Today')).toBeInTheDocument();
    expect(screen.queryByText('Set up your farm')).not.toBeInTheDocument();
  });
});

describe('Dashboard "Today" panel', () => {
  it('renders grouped rows with severity badges and deep links', async () => {
    mockFetchRoutes(routes());
    renderDash('OWNER');

    expect(await screen.findByText('Feed morning ration')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks today' })).toHaveAttribute('href', '/daily/tasks');

    expect(screen.getByText('B-001 · Ranikhet')).toBeInTheDocument();
    expect(screen.getByText('1 due')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vaccinations due' })).toHaveAttribute('href', '/health/vaccination');

    expect(screen.getByText('SBI')).toBeInTheDocument();
    expect(screen.getByText('15-07-2026')).toBeInTheDocument(); // DD-MM-YYYY
    expect(screen.getByRole('link', { name: 'EMI due' })).toHaveAttribute('href', '/finance/emi');
  });

  it('shows a friendly all-clear empty state when nothing is due', async () => {
    mockFetchRoutes(routes({ '/api/farm/due': () => jsonResponse(200, emptyDue) }));
    renderDash('OWNER');
    expect(await screen.findByText('All clear for today')).toBeInTheDocument();
  });
});

describe('Dashboard role-aware ordering', () => {
  it('OWNER: onboarding + finance first; profit hero for the period is shown', async () => {
    mockFetchRoutes(routes());
    renderDash('OWNER');
    expect(await screen.findByText('Finance trend')).toBeInTheDocument();
    expect(await screen.findByText('₹3.0k')).toBeInTheDocument(); // 300000 paise profit
    await waitFor(() =>
      expect(blockOrder()).toEqual(['onboarding', 'finance', 'kpis', 'today', 'charts']),
    );
  });

  it('LABOUR: quick-log actions first, finance hidden', async () => {
    mockFetchRoutes(routes());
    renderDash('LABOUR');
    expect(await screen.findByRole('link', { name: /Open daily logs/ })).toHaveAttribute('href', '/daily/logs');
    expect(screen.getByRole('link', { name: /Today’s tasks/ })).toHaveAttribute('href', '/daily/tasks');
    await waitFor(() => expect(blockOrder()[0]).toBe('quick'));
    expect(screen.queryByText('Finance trend')).not.toBeInTheDocument();
    expect(screen.queryByText('Net profit')).not.toBeInTheDocument();
    // finance-only due groups are filtered out for LABOUR
    await screen.findByText('Feed morning ration');
    expect(screen.queryByText('SBI')).not.toBeInTheDocument();
  });

  it('ACCOUNTANT: finance trend first with invoice/expense links', async () => {
    mockFetchRoutes(routes());
    renderDash('ACCOUNTANT');
    expect(await screen.findByText('Finance trend')).toBeInTheDocument();
    await waitFor(() => expect(blockOrder()[0]).toBe('finance'));
    expect(screen.getByRole('link', { name: 'Invoices' })).toHaveAttribute('href', '/finance/invoices');
    expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', '/finance/expenses');
    expect(screen.queryByText('Set up your farm')).not.toBeInTheDocument(); // owners-only card
  });
});

describe('Dashboard error handling + weather refresh', () => {
  it('shows a real error state with Retry (never a fake empty), and retries', async () => {
    let calls = 0;
    mockFetchRoutes(
      routes({
        '/api/farm/dashboard': () => {
          calls += 1;
          return calls === 1
            ? jsonResponse(500, { error: { code: 'INTERNAL' } })
            : jsonResponse(200, dash);
        },
      }),
    );
    renderDash('OWNER');

    const errors = await screen.findAllByText('Couldn’t load this section.');
    expect(errors.length).toBeGreaterThan(0);
    expect(screen.queryByText('No market rates recorded yet.')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Retry' })[0]!);
    expect(await screen.findByText('Open risks')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('weather card shows a MOCK badge and the sweep refresh posts to the API', async () => {
    const sweeps: string[] = [];
    mockFetchRoutes(
      routes({
        '/api/farm/intelligence/sweep': (init) => {
          sweeps.push(String(init?.method));
          return jsonResponse(200, { dispatched: 1 });
        },
      }),
    );
    renderDash('OWNER');

    expect(await screen.findByText('MOCK')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Refresh weather & risks' }));
    await waitFor(() => expect(sweeps).toEqual(['POST']));
    expect(await screen.findByText('Weather & risks refreshed')).toBeInTheDocument();
  });
});
