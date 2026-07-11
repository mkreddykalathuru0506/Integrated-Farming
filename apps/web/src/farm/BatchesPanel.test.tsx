import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { BatchesPanel } from './BatchesPanel';

const batch = {
  id: 'b1',
  code: 'BR-2026-01',
  name: null,
  initialCount: 100,
  currentCount: 97,
  status: 'ACTIVE',
  qrCode: 'IFM-B-1',
  species: { id: 's1', code: 'BROILER', name: 'Broiler chicken' },
  breed: null,
  unit: null,
  currentStage: { id: 'st1', name: 'Chick', sequence: 1, isTerminal: false },
};

const species = [
  { id: 's1', code: 'BROILER', name: 'Broiler chicken', trackingMode: 'BATCH', isSystemDefault: true },
];

const speciesDetail = {
  ...species[0],
  breeds: [{ id: 'br1', name: 'Cobb 500', isSystemDefault: true }],
  stages: [],
};

const performance = {
  batch: {
    id: 'b1',
    code: 'BR-2026-01',
    name: null,
    status: 'ACTIVE',
    initialCount: 100,
    currentCount: 97,
    acquiredAt: null,
    species: { id: 's1', name: 'Broiler chicken' },
    currentStage: { name: 'Chick' },
  },
  fcr: { feedConsumedKg: 12, weightGainKg: 6, feedCostPaise: '48000', fcr: 2 },
  cost: { totalPaise: '123456', costPerBirdPaise: '1273', currentCount: 97, byCategory: { FEED: '48000' } },
  feedSeries: [],
  weightSeries: [],
  mortality: { ratePct: 3, series: [] },
  timeline: [],
};

function routes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/batches': () => jsonResponse(200, { batches: [batch] }),
    '/api/farm/species': () => jsonResponse(200, { species }),
    '/api/farm/species/s1': () => jsonResponse(200, { species: speciesDetail }),
    '/api/farm/units': () => jsonResponse(200, { units: [] }),
    '/api/farm/batches/b1/performance': () => jsonResponse(200, performance),
    '/api/farm/mortality': () => jsonResponse(200, { events: [] }),
    '/api/farm/movements': () => jsonResponse(200, { movements: [] }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <BatchesPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BatchesPanel (11.6a rewrite)', () => {
  it('renders batch rows with counts and status', async () => {
    routes();
    renderPanel();
    // DataTable renders desktop table + mobile cards (CSS hides one) → use *AllBy* queries.
    expect((await screen.findAllByText('BR-2026-01')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  // Generous timeout: dialog + several user.type() calls are slow under jsdom.
  it('creates a batch from the dialog including the dormant name/breed/unit fields', { timeout: 20000 }, async () => {
    const posts: unknown[] = [];
    routes({
      '/api/farm/batches': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { batch: { ...batch, id: 'b2', code: 'BR-2026-02' } });
        }
        return jsonResponse(200, { batches: [batch] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('BR-2026-01')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add batch' }));
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText(/^Species/), 's1');
    await user.type(within(dialog).getByLabelText(/^Batch code/), 'BR-2026-02');
    await user.type(within(dialog).getByLabelText(/^Initial count/), '50');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Winter flock');
    // breed select becomes enabled once the species detail loads
    await waitFor(() =>
      expect(within(dialog).getByLabelText(/^Breed/)).toBeEnabled(),
    );
    await user.selectOptions(within(dialog).getByLabelText(/^Breed/), 'br1');
    await user.click(within(dialog).getByRole('button', { name: 'Add batch' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      speciesId: 's1',
      code: 'BR-2026-02',
      initialCount: 50,
      name: 'Winter flock',
      breedId: 'br1',
    });
    expect(await screen.findByText('Batch added')).toBeInTheDocument();
  });

  it('opens the detail dialog with performance stats and gates close behind ConfirmDialog', async () => {
    const closes: string[] = [];
    routes({
      '/api/farm/batches/b1/close': (init) => {
        if (init?.method === 'POST') {
          closes.push('b1');
          return jsonResponse(200, { batch: { ...batch, status: 'CLOSED' } });
        }
        return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
      },
    });
    renderPanel();

    const user = userEvent.setup();
    await user.click((await screen.findAllByText('BR-2026-01'))[0]!);

    // performance stats render in the detail dialog
    expect(await screen.findByText('FCR')).toBeInTheDocument();
    expect(screen.getByText('₹1,234.56')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close batch' }));

    // confirm dialog appears; nothing closed yet
    expect(await screen.findByText('Close batch?')).toBeInTheDocument();
    expect(closes).toHaveLength(0);

    const confirmDialog = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryByText('Close batch?'))!;
    await user.click(within(confirmDialog).getByRole('button', { name: 'Close batch' }));

    await waitFor(() => expect(closes).toEqual(['b1']));
    expect(await screen.findByText('Batch closed')).toBeInTheDocument();
  });
});
