import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { OrdersPanel } from './OrdersPanel';

// Dialog-heavy userEvent flows (RHF field arrays) can exceed the 5s default on
// loaded CI runners — allow more headroom for this file.
vi.setConfig({ testTimeout: 20_000 });

const order = {
  id: 'o1',
  orderNumber: 'SO-2026-27-0001',
  status: 'DRAFT',
  orderDate: '2026-07-01T00:00:00.000Z',
  expectedDate: null,
  totalPaise: '250000',
  notes: null,
  customer: { id: 'c1', name: 'Hotel Annapurna', state: 'TS' },
  lines: [
    {
      id: 'ol1',
      description: 'Whole chicken',
      qty: '10',
      unit: 'kg',
      unitPricePaise: '25000',
      lineTotalPaise: '250000',
      batchId: null,
      productLotId: null,
    },
  ],
};

const baseRoutes: Record<string, RouteHandler> = {
  '/api/farm/customers': () => jsonResponse(200, { customers: [{ id: 'c1', name: 'Hotel Annapurna', gstin: null, state: 'TS' }] }),
  '/api/farm/lots': () => jsonResponse(200, { lots: [] }),
  '/api/farm/batches': () => jsonResponse(200, { batches: [] }),
};

function renderPanel(canAddCustomer = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <OrdersPanel farmId="f1" canWrite canAddCustomer={canAddCustomer} />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OrdersPanel', () => {
  it('renders orders in the table with formatted money and status badge', async () => {
    mockFetchRoutes({ ...baseRoutes, '/api/farm/orders': () => jsonResponse(200, { orders: [order] }) });
    renderPanel();
    expect((await screen.findAllByText('SO-2026-27-0001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹2,500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });

  it('creates a multi-line order through the dialog (POST body includes paise string)', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/orders': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { order });
        }
        return jsonResponse(200, { orders: [order] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('SO-2026-27-0001')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New order' }));
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText(/Customer/), 'c1');
    await user.type(within(dialog).getByLabelText(/Description/), 'Chicken breast');
    await user.type(within(dialog).getByLabelText(/^Qty/), '2');
    await user.type(within(dialog).getByLabelText(/Unit price/), '250');
    await user.click(within(dialog).getByRole('button', { name: 'Take order' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      customerId: 'c1',
      lines: [{ description: 'Chicken breast', qty: 2, unit: 'kg', unitPricePaise: '25000' }],
    });
    expect(await screen.findByText('Order created')).toBeInTheDocument();
  });

  it('no-customer CTA is gated: a MANAGER (canAddCustomer=false) gets guidance, not a dead link', async () => {
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/customers': () => jsonResponse(200, { customers: [] }),
      '/api/farm/orders': () => jsonResponse(200, { orders: [] }),
    });
    renderPanel(false);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New order' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Ask an owner or accountant to add a customer first.')).toBeInTheDocument();
    // The dead-ending "Go to invoices" CTA must NOT render for this role.
    expect(within(dialog).queryByRole('button', { name: 'Go to invoices' })).not.toBeInTheDocument();
  });

  it('no-customer CTA shows the invoices link for an OWNER/ACCOUNTANT (canAddCustomer=true)', async () => {
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/customers': () => jsonResponse(200, { customers: [] }),
      '/api/farm/orders': () => jsonResponse(200, { orders: [] }),
    });
    renderPanel(true);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New order' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Go to invoices' })).toBeInTheDocument();
  });

  it('opens the detail dialog with lines, and cancel goes through ConfirmDialog', async () => {
    const patches: unknown[] = [];
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/orders': () => jsonResponse(200, { orders: [order] }),
      '/api/farm/orders/o1/status': (init) => {
        patches.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { order: { ...order, status: 'CANCELLED' } });
      },
    });
    renderPanel();
    const cells = await screen.findAllByText('SO-2026-27-0001');
    const user = userEvent.setup();
    await user.click(cells[0]!);

    // Detail dialog renders the order lines that the list view never showed.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Order SO-2026-27-0001');
    expect(dialog).toHaveTextContent('Whole chicken');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));
    // ConfirmDialog stacks on top (Radix hides the detail dialog from the a11y
    // tree while the confirm modal is open); nothing patched yet.
    const confirm = await screen.findByRole('dialog', { name: 'Cancel this order?' });
    expect(patches).toHaveLength(0);
    await user.click(within(confirm).getByRole('button', { name: 'Cancel order' }));

    await waitFor(() => expect(patches).toEqual([{ status: 'CANCELLED' }]));
    expect(await screen.findByText('Order cancelled')).toBeInTheDocument();
  });
});
