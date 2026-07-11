import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor, within } from '@testing-library/react';

// jsdom + Radix dialogs are slow when the full suite runs in parallel — the 1 s
// default async timeout flakes under load.
configure({ asyncUtilTimeout: 5000 });
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { ByproductPanel } from './ByproductPanel';

const transfer = {
  id: 't1',
  byproductType: 'LITTER',
  fromUnitId: 'u1',
  toUnitId: 'u2',
  sourceBatchId: 'b1',
  quantity: '120',
  unit: 'kg',
  creditPaise: '46000',
  transferredAt: '2026-07-01T00:00:00.000Z',
  notes: null,
};
const units = [
  { id: 'u1', name: 'Poultry Shed 1', type: 'POULTRY', code: null, isActive: true, createdAt: '' },
  { id: 'u2', name: 'Nursery', type: 'NURSERY', code: null, isActive: true, createdAt: '' },
];
const batches = [
  {
    id: 'b1',
    code: 'B-001',
    name: 'Broilers',
    initialCount: 100,
    currentCount: 90,
    status: 'ACTIVE',
    qrCode: null,
    species: { id: 'sp1', code: 'CHK', name: 'Chicken' },
    breed: null,
    unit: null,
    currentStage: null,
  },
];

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <ByproductPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('ByproductPanel', () => {
  it('renders transfers with unit names, source batch code and credit', async () => {
    mockFetchRoutes({
      '/api/farm/byproducts': () => jsonResponse(200, { transfers: [transfer] }),
      '/api/farm/units': () => jsonResponse(200, { units }),
      '/api/farm/batches': () => jsonResponse(200, { batches }),
    });
    renderPanel();
    expect((await screen.findAllByText('Poultry Shed 1 → Nursery')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('B-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹460.00').length).toBeGreaterThan(0);
    // cross-link to circularity
    expect(screen.getByRole('link', { name: /See circularity impact/ })).toHaveAttribute(
      'href',
      '/maintenance/circularity',
    );
  });

  it('records a transfer including the previously-dropped sourceBatchId', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/byproducts': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { transfer: { ...transfer, id: 't2' } });
        }
        return jsonResponse(200, { transfers: [] });
      },
      '/api/farm/units': () => jsonResponse(200, { units }),
      '/api/farm/batches': () => jsonResponse(200, { batches }),
      '/api/farm/byproducts/circularity': () =>
        jsonResponse(200, { totalCreditPaise: '0', totalQuantity: 0, transferCount: 0, byType: [], byDestination: [] }),
    });
    renderPanel();
    expect(await screen.findByText('No byproduct transfers yet')).toBeInTheDocument();

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getAllByRole('button', { name: 'Record a transfer' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/From unit/), 'u1');
    await user.selectOptions(within(dialog).getByLabelText(/To unit/), 'u2');
    await user.selectOptions(within(dialog).getByLabelText(/Source batch/), 'b1');
    await user.type(within(dialog).getByLabelText(/Quantity/), '120');
    await user.type(within(dialog).getByLabelText(/Value saved/), '460');
    await user.click(within(dialog).getByRole('button', { name: 'Transfer' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      byproductType: 'LITTER',
      fromUnitId: 'u1',
      toUnitId: 'u2',
      sourceBatchId: 'b1',
      quantity: 120,
      unit: 'kg',
      creditPaise: '46000',
    });
    expect(await screen.findByText('Transfer recorded')).toBeInTheDocument();
  });
});
