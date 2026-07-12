import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { ExpensesPanel } from './ExpensesPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

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
      items: [
        {
          id: 'e1',
          category: 'MEDICINE',
          amountPaise: '250000',
          occurredAt: '2026-06-15T00:00:00.000Z',
          batchId: 'b1',
          description: 'Vaccines',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
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

describe('ExpensesPanel edit/delete (slice 11.9)', () => {
  it('edits an expense through the prefilled dialog (PATCH category/amount/description/date)', async () => {
    const patches: unknown[] = [];
    mockFetchRoutes({
      ...routes([]),
      '/api/farm/expenses/e1': (init?: RequestInit) => {
        patches.push({ method: init?.method, body: JSON.parse(String(init?.body)) });
        return jsonResponse(200, {
          expense: {
            id: 'e1',
            category: 'UTILITIES',
            amountPaise: '300000',
            occurredAt: '2026-06-15T00:00:00.000Z',
            batchId: 'b1',
            description: 'Vaccines + syringes',
          },
        });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Vaccines')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    // DataTable renders desktop + mobile variants — pick the first instance.
    await user.click(screen.getAllByRole('button', { name: 'Edit expense' })[0]!);
    const dialog = await screen.findByRole('dialog');

    // prefilled from the row: ₹2,500.00 → "2500", category MEDICINE, IST day
    const amount = within(dialog).getByLabelText(/Amount/);
    expect(amount).toHaveValue('2500');
    expect(within(dialog).getByLabelText(/Category/)).toHaveValue('MEDICINE');
    expect(within(dialog).getByLabelText(/Date/)).toHaveValue('2026-06-15');

    await user.clear(amount);
    await user.type(amount, '3000');
    await user.selectOptions(within(dialog).getByLabelText(/Category/), 'UTILITIES');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({
      method: 'PATCH',
      body: {
        category: 'UTILITIES',
        amountPaise: '300000',
        description: 'Vaccines',
        occurredAt: '2026-06-15T00:00:00.000Z',
      },
    });
    expect(await screen.findByText('Expense updated')).toBeInTheDocument();
  });

  it('deletes an expense behind a danger confirm dialog (DELETE + toast)', async () => {
    const calls: string[] = [];
    mockFetchRoutes({
      ...routes([]),
      '/api/farm/expenses/e1': (init?: RequestInit) => {
        calls.push(String(init?.method));
        return jsonResponse(200, { ok: true, id: 'e1' });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Vaccines')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Delete expense' })[0]!);
    expect(await screen.findByText('Delete this expense?')).toBeInTheDocument();
    expect(calls).toHaveLength(0); // nothing fired until confirmed

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls).toEqual(['DELETE']));
    expect(await screen.findByText('Expense deleted')).toBeInTheDocument();
  });
});
