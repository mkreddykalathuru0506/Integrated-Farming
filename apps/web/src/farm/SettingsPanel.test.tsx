import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor } from '@testing-library/react';

// jsdom + Radix dialogs are slow when the full suite runs in parallel — the 1 s
// default async timeout flakes under load.
configure({ asyncUtilTimeout: 5000 });
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { SettingsPanel } from './SettingsPanel';

const settings = {
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  defaultLocale: 'en',
  areaUnit: 'acre',
  fssaiLicenseNo: null,
  fssaiTier: null,
  gstin: null,
  gstThresholdPaise: '400000000',
  latitude: null,
  longitude: null,
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <SettingsPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('SettingsPanel', () => {
  it('shows the read-only farm defaults (GST threshold via fmtInr)', async () => {
    mockFetchRoutes({ '/api/farm/settings': () => jsonResponse(200, { settings }) });
    renderPanel();
    expect(await screen.findByText('Asia/Kolkata')).toBeInTheDocument();
    expect(screen.getByText('INR')).toBeInTheDocument();
    expect(screen.getByText('acre')).toBeInTheDocument();
    expect(screen.getByText('₹40,00,000.00')).toBeInTheDocument();
  });

  it('blocks an invalid FSSAI number (must be exactly 14 digits) without calling the API', async () => {
    const puts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/settings': (init) => {
        if (init?.method === 'PUT') {
          puts.push(JSON.parse(String(init.body)));
          return jsonResponse(200, { settings });
        }
        return jsonResponse(200, { settings });
      },
    });
    renderPanel();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/FSSAI license number/), '123');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('FSSAI license must be exactly 14 digits')).toBeInTheDocument();
    expect(puts).toHaveLength(0);
  });

  it('saves valid values (FSSAI 14 digits, GSTIN uppercased, lat/lon numeric)', async () => {
    const puts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/settings': (init) => {
        if (init?.method === 'PUT') {
          puts.push(JSON.parse(String(init.body)));
          return jsonResponse(200, { settings });
        }
        return jsonResponse(200, { settings });
      },
    });
    renderPanel();

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/FSSAI license number/), '12345678901234');
    await user.type(screen.getByLabelText(/GSTIN/), '36abcde1234f1z5');
    await user.type(screen.getByLabelText(/Latitude/), '17.385');
    await user.type(screen.getByLabelText(/Longitude/), '78.4867');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      fssaiLicenseNo: '12345678901234',
      fssaiTier: null,
      gstin: '36ABCDE1234F1Z5',
      latitude: 17.385,
      longitude: 78.4867,
    });
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });
});
