import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { HatcheryPanel } from './HatcheryPanel';

const hatch = {
  id: 'h1',
  code: 'H-1',
  speciesId: 's1',
  breedId: null,
  setDate: '2026-07-01T00:00:00.000Z',
  eggCount: 100,
  incubationDays: 21,
  expectedHatchDate: '2026-07-22T00:00:00.000Z',
  candlingDate: '2026-07-08T00:00:00.000Z',
  lockdownDate: '2026-07-19T00:00:00.000Z',
  status: 'INCUBATING',
  fertileCount: null,
  hatchedCount: null,
  hatchRate: 0,
  fertilityRate: 0,
};

function baseRoutes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/hatchery': () => jsonResponse(200, { batches: [hatch] }),
    '/api/farm/species': () =>
      jsonResponse(200, {
        species: [{ id: 's1', code: 'CHICKEN', name: 'Chicken', trackingMode: 'BATCH', isSystemDefault: true }],
      }),
    '/api/farm/species/s1': () =>
      jsonResponse(200, { species: { id: 's1', code: 'CHICKEN', name: 'Chicken', breeds: [], stages: [] } }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <HatcheryPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HatcheryPanel (incubation batches)', () => {
  it('renders the batches table with dates, status badge and — for unset rates', async () => {
    baseRoutes();
    renderPanel();

    expect((await screen.findAllByText('H-1')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('01-07-2026')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('22-07-2026')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Incubating')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('—')).length).toBeGreaterThan(0); // rates not yet recorded
  });

  it('sets eggs via the create dialog', async () => {
    const posts: unknown[] = [];
    baseRoutes({
      '/api/farm/hatchery': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { batch: { ...hatch, id: 'h2', code: 'H-2' } });
        }
        return jsonResponse(200, { batches: [hatch] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('H-1')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Set eggs/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Batch code/), 'H-2');
    await user.type(within(dialog).getByLabelText(/Eggs/), '120');
    await user.click(within(dialog).getByRole('button', { name: 'Set eggs' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0] as { speciesId: string; code: string; eggCount: number; setDate: string };
    expect(body.speciesId).toBe('s1');
    expect(body.code).toBe('H-2');
    expect(body.eggCount).toBe(120);
    expect(body.setDate).toMatch(/T00:00:00\.000Z$/);
    expect(await screen.findByText('Eggs set')).toBeInTheDocument();
  });

  it('records results accepting a legitimate ZERO hatched count and sends fertileCount', async () => {
    const patches: unknown[] = [];
    baseRoutes({
      '/api/farm/hatchery/h1': (init) => {
        if (init?.method === 'PATCH') {
          patches.push(JSON.parse(String(init.body)));
          return jsonResponse(200, {
            batch: { ...hatch, status: 'HATCHED', hatchedCount: 0, fertileCount: 60 },
          });
        }
        return jsonResponse(200, { batch: { ...hatch, incubationLogs: [] } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('H-1')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Record results' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Hatched count/), '0');
    await user.type(within(dialog).getByLabelText(/Fertile count/), '60');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // regression: `0` hatched must be submitted, not silently dropped
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ status: 'HATCHED', hatchedCount: 0, fertileCount: 60 });
    expect(await screen.findByText('Hatchery batch updated')).toBeInTheDocument();
  });

  it('opens the detail dialog with the incubation timeline and logs on row click', async () => {
    baseRoutes({
      '/api/farm/hatchery/h1': () =>
        jsonResponse(200, {
          batch: {
            ...hatch,
            incubationLogs: [
              {
                id: 'l1',
                event: 'TEMP_LOG',
                occurredAt: '2026-07-05T06:30:00.000Z',
                temperatureC: 37.6,
                humidityPct: 58,
              },
            ],
          },
        }),
    });
    renderPanel();

    const user = userEvent.setup();
    await user.click((await screen.findAllByText('H-1'))[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Eggs set')).toBeInTheDocument();
    // 'Candling' also appears as an add-log <option>, so use getAllByText
    expect(within(dialog).getAllByText('Candling').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Expected hatch')).toBeInTheDocument();
    expect(within(dialog).getByText('Incubation logs')).toBeInTheDocument();
    expect(within(dialog).getByText('37.6°C')).toBeInTheDocument();
    expect(within(dialog).getByText('58% RH')).toBeInTheDocument();
  });
});
