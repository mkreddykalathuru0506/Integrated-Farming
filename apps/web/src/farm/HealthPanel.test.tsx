import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { HealthPanel } from './HealthPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const species = { id: 's1', code: 'CHICKEN', name: 'Chicken' };
const makeBatch = (id: string, code: string, name: string | null) => ({
  id,
  code,
  name,
  initialCount: 100,
  currentCount: 90,
  status: 'ACTIVE',
  qrCode: null,
  species,
  breed: null,
  unit: null,
  currentStage: null,
});

const IN_5_DAYS = new Date(Date.now() + 4.5 * 86_400_000).toISOString();

function baseRoutes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/batches': () =>
      jsonResponse(200, { batches: [makeBatch('b1', 'B-001', 'Broilers A'), makeBatch('b2', 'B-002', null)] }),
    '/api/farm/animals': () => jsonResponse(200, { animals: [] }),
    '/api/farm/health/records': () => jsonResponse(200, { records: [] }),
    // ONE farm-wide withdrawals request (slice 11.8a) — b1 under withdrawal, b2 clear.
    '/api/farm/health/withdrawals': () =>
      jsonResponse(200, {
        withdrawals: [
          {
            batchId: 'b1',
            batchCode: 'B-001',
            batchName: 'Broilers A',
            currentCount: 90,
            drugName: 'Oxytet',
            until: IN_5_DAYS,
          },
        ],
      }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <HealthPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HealthPanel (farm-wide withdrawal board)', () => {
  it('lists every ACTIVE batch with its withdrawal countdown / clear badge', async () => {
    baseRoutes();
    renderPanel();

    expect((await screen.findAllByText(/Broilers A/)).length).toBeGreaterThan(0);
    // b1 under withdrawal → destructive countdown badge; b2 clear → success badge
    expect((await screen.findAllByText(/days? left/)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Clear')).length).toBeGreaterThan(0);
    // The single endpoint delivers the binding drug name the fan-out couldn't show.
    expect((await screen.findAllByText('Oxytet')).length).toBeGreaterThan(0);
  });

  it('records a medication through the dialog (dose/route/withdrawal days)', async () => {
    const posts: unknown[] = [];
    baseRoutes({
      '/api/farm/health/medications': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { medication: { id: 'm1' } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText(/Broilers A/)).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Record medication/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Drug name/), 'Oxytet');
    await user.click(within(dialog).getByRole('button', { name: 'Record' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ batchId: 'b1', drugName: 'Oxytet', withdrawalDays: 7 });
    expect(await screen.findByText('Medication recorded')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('gates sale-ready behind ConfirmDialog and maps WITHDRAWAL_ACTIVE to a clear message', async () => {
    const posts: unknown[] = [];
    baseRoutes({
      '/api/farm/health/sale-ready': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(422, {
          error: { code: 'WITHDRAWAL_ACTIVE', message: 'blocked' },
        });
      },
    });
    renderPanel();
    expect((await screen.findAllByText(/Broilers A/)).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Mark sale-ready' })[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Mark sale-ready?');
    expect(posts).toHaveLength(0); // nothing sent before confirmation

    await user.click(within(dialog).getByRole('button', { name: 'Mark sale-ready' }));
    await waitFor(() => expect(posts).toEqual([{ batchId: 'b1' }]));
    expect(
      await screen.findByText('Blocked: under medication withdrawal period'),
    ).toBeInTheDocument();
  });

  it('shows the health-event history from GET /health/records', async () => {
    baseRoutes({
      '/api/farm/health/records': () =>
        jsonResponse(200, {
          records: [
            {
              id: 'r1',
              type: 'TREATMENT',
              occurredAt: '2026-07-01T00:00:00.000Z',
              description: 'Antibiotic course',
              vetName: 'Dr. Rao',
              animalId: null,
              batchId: 'b1',
            },
          ],
        }),
    });
    renderPanel();

    expect((await screen.findAllByText('Treatment')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Antibiotic course')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('01-07-2026')).length).toBeGreaterThan(0);
  });
});
