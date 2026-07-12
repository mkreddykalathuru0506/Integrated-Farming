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
import { WeatherPanel } from './WeatherPanel';

const weatherOk = {
  weather: {
    tempC: 31,
    humidityPct: 62,
    condition: 'clear',
    source: 'mock',
    observedAt: '2026-07-10T06:00:00.000Z',
    fetchedAt: '2026-07-10T06:00:00.000Z',
  },
  cached: true,
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <WeatherPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('WeatherPanel', () => {
  it('LOCATION_REQUIRED deep-links to farm settings instead of loading forever', async () => {
    mockFetchRoutes({
      '/api/farm/weather': () =>
        jsonResponse(422, { error: { code: 'LOCATION_REQUIRED', message: 'set location' } }),
      '/api/farm/risk': () => jsonResponse(200, { risks: [] }),
    });
    renderPanel();
    expect(await screen.findByText('Location needed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open farm settings/ })).toHaveAttribute('href', '/settings/settings');
  });

  it('any other failure shows a real error state with Retry (permanent-loading trap fixed)', async () => {
    mockFetchRoutes({
      '/api/farm/weather': () => jsonResponse(500, { error: { code: 'REQUEST_FAILED', message: 'boom' } }),
      '/api/farm/risk': () => jsonResponse(200, { risks: [] }),
    });
    renderPanel();
    expect(await screen.findByText('Could not load weather')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders conditions with a MOCK badge and open risk alerts', async () => {
    mockFetchRoutes({
      '/api/farm/weather': () => jsonResponse(200, weatherOk),
      '/api/farm/risk': () =>
        jsonResponse(200, {
          risks: [
            {
              id: 'r1',
              type: 'HEAT_STRESS',
              severity: 'WARNING',
              reason: 'Temp 38°C above threshold',
              status: 'OPEN',
              source: 'mock',
              createdAt: '2026-07-10T06:00:00.000Z',
              acknowledgedAt: null,
            },
          ],
        }),
    });
    renderPanel();
    expect(await screen.findByText(/31°C/)).toBeInTheDocument();
    expect(screen.getByText('Mock data')).toBeInTheDocument();
    expect(screen.getByText(/source mock/)).toBeInTheDocument();
    expect((await screen.findAllByText('Temp 38°C above threshold')).length).toBeGreaterThan(0);
  });
});
