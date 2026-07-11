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
import { MarketPanel } from './MarketPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const rate = {
  id: 'r1',
  commodity: 'Broiler',
  market: 'Hyderabad',
  pricePaise: '12500',
  unit: 'kg',
  source: 'manual',
  observedAt: '2026-07-10T06:00:00.000Z',
  fetchedAt: '2026-07-10T06:00:00.000Z',
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <MarketPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('MarketPanel', () => {
  it('renders rates with source badge and price per unit, plus the history section', async () => {
    mockFetchRoutes({
      '/api/farm/market': () => jsonResponse(200, { rates: [rate] }),
      '/api/farm/market/history': () => jsonResponse(200, { rates: [rate] }),
    });
    renderPanel();
    expect((await screen.findAllByText('Broiler')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹125.00/kg').length).toBeGreaterThan(0);
    expect(screen.getAllByText('manual').length).toBeGreaterThan(0);
    expect(screen.getByText('Price history')).toBeInTheDocument();
  });

  it('wires the Phase-7 live adapter: per-row Refresh posts to /market/refresh', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/market': () => jsonResponse(200, { rates: [rate] }),
      '/api/farm/market/history': () => jsonResponse(200, { rates: [rate] }),
      '/api/farm/market/refresh': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { rate: { ...rate, id: 'r2', source: 'mock' } });
      },
    });
    renderPanel();
    const user = userEvent.setup({ delay: null });
    await user.click((await screen.findAllByRole('button', { name: /Refresh from source/ }))[0]!);
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ commodity: 'Broiler', market: 'Hyderabad' });
    expect(await screen.findByText('Rate refreshed from mock')).toBeInTheDocument();
  });

  it('records a manual rate and toasts the price-drop risk from the response', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/market': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, {
            rate: { ...rate, id: 'r3', pricePaise: '8000' },
            risk: { atRisk: true, severity: 'CRITICAL', reason: 'Broiler: price dropped 36%' },
          });
        }
        return jsonResponse(200, { rates: [rate] });
      },
      '/api/farm/market/history': () => jsonResponse(200, { rates: [rate] }),
    });
    renderPanel();

    const user = userEvent.setup({ delay: null });
    await user.click(await screen.findByRole('button', { name: 'Record a rate' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Commodity/), 'Broiler');
    await user.type(within(dialog).getByLabelText(/Price/), '80');
    await user.click(within(dialog).getByRole('button', { name: 'Save rate' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ commodity: 'Broiler', pricePaise: '8000', unit: 'kg' });
    expect(await screen.findByText('Rate recorded')).toBeInTheDocument();
    expect(await screen.findByText(/price dropped 36%/)).toBeInTheDocument();
  });
});
