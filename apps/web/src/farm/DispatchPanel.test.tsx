import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { DispatchPanel } from './DispatchPanel';

// Dialog-heavy userEvent flows can exceed the 5s default on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

const dispatch = {
  id: 'd1',
  dispatchedAt: '2026-07-08T09:00:00.000Z',
  refrigeratedTransport: true,
  vehicleNumber: 'TS09AB1234',
  dispatchTempC: -19,
  coldChainOk: true,
  salesOrder: { id: 'o1', orderNumber: 'SO-2026-27-0001', status: 'DISPATCHED' },
  lines: [
    {
      id: 'dl1',
      qtyKg: '10',
      count: null,
      batchId: null,
      productLot: {
        id: 'l1',
        lotCode: 'IFM-L-l1',
        productName: 'Whole dressed chicken',
        state: 'FROZEN',
        sourceBatch: { id: 'b1', code: 'B-001', species: { name: 'Chicken (Broiler)' } },
      },
    },
  ],
};

const confirmedOrder = {
  id: 'o2',
  orderNumber: 'SO-2026-27-0002',
  status: 'CONFIRMED',
  orderDate: '2026-07-09T00:00:00.000Z',
  expectedDate: null,
  totalPaise: '100000',
  notes: null,
  customer: { id: 'c1', name: 'Hotel Annapurna', state: 'TS' },
  lines: [],
};

const availableLot = {
  id: 'l1',
  lotCode: 'IFM-L-l1',
  qrCode: 'IFM-L-l1',
  productName: 'Whole dressed chicken',
  state: 'FROZEN',
  initialQuantityKg: '30',
  quantityKg: '20',
  status: 'AVAILABLE',
  producedAt: '2026-07-05T00:00:00.000Z',
  expiryDate: null,
  coldStorageId: null,
  sourceBatchId: 'b1',
  sourceBatch: { id: 'b1', code: 'B-001', species: { name: 'Chicken (Broiler)' } },
  coldStorage: null,
};

const baseRoutes: Record<string, RouteHandler> = {
  '/api/farm/orders': () => jsonResponse(200, { orders: [confirmedOrder] }),
  '/api/farm/lots': () => jsonResponse(200, { lots: [availableLot] }),
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <DispatchPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Opens the create dialog and fills order + one lot line; does NOT submit. */
async function openAndFillDispatchForm() {
  const user = userEvent.setup();
  // Empty list renders the CTA in both the header and the EmptyState.
  await user.click(screen.getAllByRole('button', { name: 'New dispatch' })[0]!);
  const dialog = await screen.findByRole('dialog');
  await user.selectOptions(within(dialog).getByLabelText(/Confirmed order/), 'o2');
  await user.selectOptions(within(dialog).getByLabelText(/Product lot/), 'l1');
  await user.type(within(dialog).getByLabelText(/Qty \(kg\)/), '5');
  return { user, dialog };
}

describe('DispatchPanel', () => {
  it('renders dispatches with the cold-chain badge and provenance in the detail dialog', async () => {
    mockFetchRoutes({ ...baseRoutes, '/api/farm/dispatches': () => jsonResponse(200, { dispatches: [dispatch] }) });
    renderPanel();
    const rows = await screen.findAllByText('SO-2026-27-0001');
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cold chain OK').length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(rows[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Dispatch — SO-2026-27-0001');
    expect(dialog).toHaveTextContent('Whole dressed chicken');
    expect(dialog).toHaveTextContent('from batch B-001');
  });

  it('creates a dispatch (POST body: order, refrigeration, lot lines) and shows the frozen hint', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/dispatches': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { dispatch });
        }
        return jsonResponse(200, { dispatches: [] });
      },
    });
    renderPanel();
    expect(await screen.findByText('No dispatches yet')).toBeInTheDocument();

    const { user, dialog } = await openAndFillDispatchForm();
    // Proactive gate hint appears once a FROZEN lot is selected — before submit.
    expect(await within(dialog).findByText(/Frozen product on board/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Dispatch' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      salesOrderId: 'o2',
      refrigeratedTransport: true,
      lines: [{ productLotId: 'l1', qtyKg: 5 }],
    });
    expect(await screen.findByText('Dispatched — order marked as dispatched')).toBeInTheDocument();
  });

  it('maps COLD_CHAIN_FAIL (422) to a detailed in-dialog explanation of the gate', async () => {
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/dispatches': (init) => {
        if (init?.method === 'POST') {
          return jsonResponse(422, {
            error: { code: 'COLD_CHAIN_FAIL', message: 'Cold chain would break: REFRIGERATION_REQUIRED' },
          });
        }
        return jsonResponse(200, { dispatches: [] });
      },
    });
    renderPanel();
    expect(await screen.findByText('No dispatches yet')).toBeInTheDocument();

    const { user, dialog } = await openAndFillDispatchForm();
    await user.click(within(dialog).getByRole('checkbox')); // turn refrigeration OFF
    await user.click(within(dialog).getByRole('button', { name: 'Dispatch' }));

    expect(
      await within(dialog).findByText('Blocked: this load would break the cold chain'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Frozen product must travel at −18°C or colder/)).toBeInTheDocument();
  });
});
