import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { ColdStoragePanel } from './ColdStoragePanel';

// Dialog-heavy userEvent flows can exceed the 5s default on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

const store = {
  id: 's1',
  name: 'Freezer A',
  mode: 'FROZEN',
  minTempC: -30,
  maxTempC: -18,
  isActive: true,
  latest: { temperatureC: -20, isOutOfRange: false, recordedAt: '2026-07-10T04:30:00.000Z' },
  breachCount: 0,
};

const baseRoutes: Record<string, RouteHandler> = {
  '/api/farm/coldstorage/s1/temps': () =>
    jsonResponse(200, {
      temps: [
        { id: 't1', temperatureC: -20, isOutOfRange: false, recordedAt: '2026-07-09T04:30:00.000Z', source: 'manual', notes: null },
        { id: 't2', temperatureC: -12, isOutOfRange: true, recordedAt: '2026-07-10T04:30:00.000Z', source: 'manual', notes: null },
      ],
    }),
  '/api/farm/units': () => jsonResponse(200, { units: [] }),
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <ColdStoragePanel farmId="f1" canWrite canLog />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ColdStoragePanel', () => {
  it('renders store cards with mode band and latest reading', async () => {
    mockFetchRoutes({ ...baseRoutes, '/api/farm/coldstorage': () => jsonResponse(200, { stores: [store] }) });
    renderPanel();
    expect(await screen.findByText('Freezer A')).toBeInTheDocument();
    expect(screen.getByText(/-30°C to -18°C/)).toBeInTheDocument();
    expect(screen.getByText('-20°C')).toBeInTheDocument();
    expect(screen.getByText('In range')).toBeInTheDocument();
  });

  it('logs a temperature and shows a LOUD warning toast when the reading is out of range', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/coldstorage': () => jsonResponse(200, { stores: [store] }),
      '/api/farm/coldstorage/s1/temps': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, {
            temp: { id: 't9', temperatureC: -2, isOutOfRange: true, recordedAt: '2026-07-11T05:00:00.000Z', source: 'manual' },
          });
        }
        return jsonResponse(200, { temps: [] });
      },
    });
    renderPanel();
    expect(await screen.findByText('Freezer A')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Temp °C'), '-2');
    await user.click(screen.getByRole('button', { name: 'Log temp' }));

    await waitFor(() => expect(posts).toEqual([{ temperatureC: -2 }]));
    expect(await screen.findByText(/OUT OF RANGE: -2°C logged/)).toBeInTheDocument();
  });

  it('creates a store via the dialog (dormant unit/band fields exposed but optional)', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/coldstorage': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { store: { ...store, id: 's2', name: 'Freezer B' } });
        }
        return jsonResponse(200, { stores: [store] });
      },
    });
    renderPanel();
    expect(await screen.findByText('Freezer A')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add cold store' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Freezer B');
    await user.click(within(dialog).getByRole('button', { name: 'Add store' }));

    await waitFor(() => expect(posts).toEqual([{ name: 'Freezer B', mode: 'FROZEN' }]));
    expect(await screen.findByText('Cold store added')).toBeInTheDocument();
  });
});
