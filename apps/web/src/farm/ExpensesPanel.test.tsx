import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { ExpensesPanel } from './ExpensesPanel';

const batch = (id: string, code: string) => ({
  id,
  code,
  name: null,
  initialCount: 100,
  currentCount: 95,
  status: 'ACTIVE',
  qrCode: null,
  species: { id: 's1', code: 'CHICKEN', name: 'Chicken' },
  breed: null,
  unit: null,
  currentStage: null,
});

const routes = (posts: unknown[]) => ({
  '/api/farm/expenses': (init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts.push(JSON.parse(String(init.body)));
      return jsonResponse(201, {
        expense: {
          id: 'e9',
          category: 'FEED',
          amountPaise: '15000',
          occurredAt: '2026-07-01T00:00:00.000Z',
          batchId: null,
          description: null,
        },
      });
    }
    return jsonResponse(200, {
      expenses: [
        {
          id: 'e1',
          category: 'MEDICINE',
          amountPaise: '250000',
          occurredAt: '2026-06-15T00:00:00.000Z',
          batchId: 'b1',
          description: 'Vaccines',
        },
      ],
    });
  },
  '/api/farm/batches': () => jsonResponse(200, { batches: [batch('b1', 'B-001')] }),
  '/api/farm/expenses/batch-cost': () =>
    jsonResponse(200, {
      totalPaise: '400000',
      costPerBirdPaise: '4210',
      currentCount: 95,
      byCategory: { FEED: '150000', MEDICINE: '250000' },
    }),
});

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <ExpensesPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExpensesPanel (11.6c conversion)', () => {
  it('renders the expense table (DD-MM-YYYY date, ₹ amount) and the batch cost rollup', async () => {
    mockFetchRoutes(routes([]));
    renderPanel();
    expect((await screen.findAllByText('15-06-2026')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Medicine').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vaccines').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹2,500.00').length).toBeGreaterThan(0);
    // batch cost card (default = first active batch)
    expect(await screen.findByText('₹4,000.00')).toBeInTheDocument(); // total
    expect(screen.getByText('₹42.10')).toBeInTheDocument(); // per bird
  });

  it('adds an expense through the dialog with an integer-paise string', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes(routes(posts));
    renderPanel();
    expect((await screen.findAllByText('Vaccines')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Amount/), '150');
    await user.type(within(dialog).getByLabelText(/Description/), 'Bulk feed');
    await user.click(within(dialog).getByRole('button', { name: 'Add expense' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ category: 'FEED', amountPaise: '15000', description: 'Bulk feed' });
    expect(await screen.findByText('Expense added')).toBeInTheDocument();
  });
});
