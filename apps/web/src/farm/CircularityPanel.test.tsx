import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen } from '@testing-library/react';

// jsdom + Radix dialogs are slow when the full suite runs in parallel — the 1 s
// default async timeout flakes under load.
configure({ asyncUtilTimeout: 5000 });
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { CircularityPanel } from './CircularityPanel';

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <CircularityPanel farmId="f1" />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('CircularityPanel', () => {
  it('shows stat tiles from the rollup', async () => {
    mockFetchRoutes({
      '/api/farm/byproducts/circularity': () =>
        jsonResponse(200, {
          totalCreditPaise: '46000',
          totalQuantity: 170,
          transferCount: 2,
          byType: [{ type: 'LITTER', creditPaise: '46000', quantity: 170, count: 2 }],
          byDestination: [{ unitId: 'u2', unitName: 'Nursery', creditPaise: '46000', count: 2 }],
        }),
    });
    renderPanel();
    expect(await screen.findByText('₹460.00')).toBeInTheDocument();
    expect(screen.getByText('Total value recycled')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('170')).toBeInTheDocument();
    expect(screen.getByText('By byproduct')).toBeInTheDocument();
    expect(screen.getByText('By destination')).toBeInTheDocument();
  });

  it('shows a real error state with Retry (no longer conflated with empty)', async () => {
    mockFetchRoutes({
      '/api/farm/byproducts/circularity': () =>
        jsonResponse(500, { error: { code: 'REQUEST_FAILED', message: 'boom' } }),
    });
    renderPanel();
    expect(await screen.findByText('Could not load circularity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('No circular savings yet')).not.toBeInTheDocument();
  });

  it('shows the empty state with a CTA when there are no transfers', async () => {
    mockFetchRoutes({
      '/api/farm/byproducts/circularity': () =>
        jsonResponse(200, { totalCreditPaise: '0', totalQuantity: 0, transferCount: 0, byType: [], byDestination: [] }),
    });
    renderPanel();
    expect(await screen.findByText('No circular savings yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record a transfer' })).toBeInTheDocument();
  });
});
