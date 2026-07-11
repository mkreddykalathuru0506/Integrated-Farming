import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { FeedPanel } from './FeedPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const item = (id: string, name: string, stockQty: string, reorderThreshold: string | null) => ({
  id,
  name,
  unit: 'kg',
  stockQty,
  reorderThreshold,
  lastUnitPricePaise: '2550',
});

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

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <FeedPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FeedPanel (11.6c conversion)', () => {
  it('renders the inventory table with a low-stock badge and formatted price', async () => {
    mockFetchRoutes({
      '/api/farm/feed': () =>
        jsonResponse(200, { items: [item('fi1', 'Starter', '100', '150'), item('fi2', 'Grower', '500', '100')] }),
      '/api/farm/batches': () => jsonResponse(200, { batches: [batch('b1', 'B-001')] }),
    });
    renderPanel();
    // stock 100 ≤ threshold 150 → low-stock warning on Starter only
    expect((await screen.findAllByText('Starter')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low stock').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹25.50/kg').length).toBeGreaterThan(0);
  });

  it('records a purchase with an integer-paise string via its own dialog form', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/feed': (init) => {
        if (init?.method === 'POST') return jsonResponse(201, { item: item('fi3', 'New', '0', null) });
        return jsonResponse(200, { items: [item('fi1', 'Starter', '100', null), item('fi2', 'Grower', '50', null)] });
      },
      '/api/farm/batches': () => jsonResponse(200, { batches: [batch('b1', 'B-001')] }),
      '/api/farm/feed/purchase': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { item: item('fi1', 'Starter', '110', null), totalPaise: '25500' });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Starter')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Record purchase/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Quantity/), '10');
    await user.type(within(dialog).getByLabelText(/Price per unit/), '25.50');
    await user.click(within(dialog).getByRole('button', { name: /Record purchase/ }));

    await waitFor(() => expect(posts).toHaveLength(1));
    // money leaves the form as an integer-paise STRING (never a float)
    expect(posts[0]).toEqual({ feedItemId: 'fi1', qty: 10, unitPricePaise: '2550' });
    expect(await screen.findByText('Purchase recorded')).toBeInTheDocument();
  });

  it('keeps purchase and consumption item selections independent (buyId bug fix)', async () => {
    mockFetchRoutes({
      '/api/farm/feed': () =>
        jsonResponse(200, { items: [item('fi1', 'Starter', '100', null), item('fi2', 'Grower', '50', null)] }),
      '/api/farm/batches': () => jsonResponse(200, { batches: [batch('b1', 'B-001')] }),
    });
    renderPanel();
    expect((await screen.findAllByText('Starter')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    // change the selection inside the purchase dialog…
    await user.click(screen.getByRole('button', { name: /Record purchase/ }));
    let dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/Feed item/), 'fi2');
    expect(within(dialog).getByLabelText(/Feed item/)).toHaveValue('fi2');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // …the consumption dialog still defaults to the first item (no shared state)
    await user.click(screen.getByRole('button', { name: /Record consumption/ }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Feed item/)).toHaveValue('fi1');
  });

  it('shows the FCR stat tiles for the selected batch', async () => {
    mockFetchRoutes({
      '/api/farm/feed': () => jsonResponse(200, { items: [item('fi1', 'Starter', '100', null)] }),
      '/api/farm/batches': () => jsonResponse(200, { batches: [batch('b1', 'B-001')] }),
      '/api/farm/feed/fcr': () =>
        jsonResponse(200, { feedConsumedKg: 120, weightGainKg: 60, feedCostPaise: '360000', fcr: 2 }),
    });
    renderPanel();
    expect((await screen.findAllByText('Starter')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'FCR' }));
    expect(await screen.findByText('120 kg')).toBeInTheDocument();
    expect(screen.getByText('60 kg')).toBeInTheDocument();
    expect(screen.getByText('₹3,600.00')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
