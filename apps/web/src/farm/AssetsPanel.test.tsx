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
import { AssetsPanel } from './AssetsPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const asset = {
  id: 'a1',
  name: 'Diesel generator',
  type: 'EQUIPMENT',
  code: null,
  status: 'ACTIVE',
  purchaseDate: '2026-01-05T00:00:00.000Z',
  purchaseCostPaise: '5000000',
  schedules: [
    { id: 's1', name: 'Oil change', intervalDays: 90, nextDueDate: '2026-07-01T00:00:00.000Z', isActive: true },
  ],
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <AssetsPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('AssetsPanel', () => {
  it('renders asset rows (type/status badges, money via fmtInr) and the reminders strip', async () => {
    mockFetchRoutes({
      '/api/farm/assets': () => jsonResponse(200, { assets: [asset] }),
      '/api/farm/assets/reminders': () =>
        jsonResponse(200, {
          due: [{ id: 's1', name: 'Oil change', nextDueDate: asset.schedules[0]!.nextDueDate, asset: { id: 'a1', name: 'Diesel generator' } }],
        }),
    });
    renderPanel();
    expect((await screen.findAllByText('Diesel generator')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Equipment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹50,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('1 service(s) due soon')).toBeInTheDocument();
  });

  it('creates an asset from the dialog (purchase cost sent as integer paise)', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/assets': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { asset: { ...asset, id: 'a2', name: 'Pump' } });
        }
        return jsonResponse(200, { assets: [asset] });
      },
      '/api/farm/assets/reminders': () => jsonResponse(200, { due: [] }),
    });
    renderPanel();
    expect((await screen.findAllByText('Diesel generator')).length).toBeGreaterThan(0);

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Add asset' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Asset name/), 'Pump');
    await user.type(within(dialog).getByLabelText(/Purchase cost/), '1250.50');
    await user.click(within(dialog).getByRole('button', { name: 'Add asset' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ name: 'Pump', type: 'EQUIPMENT', purchaseCostPaise: '125050' });
    expect(await screen.findByText('Asset added')).toBeInTheDocument();
  });

  it('records a service with cost + vendor from the detail dialog', async () => {
    const maint: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/assets': () => jsonResponse(200, { assets: [asset] }),
      '/api/farm/assets/reminders': () => jsonResponse(200, { due: [] }),
      '/api/farm/assets/a1/maintenance': (init) => {
        maint.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { record: { id: 'm1' } });
      },
    });
    renderPanel();

    const user = userEvent.setup({ delay: null });
    await user.click((await screen.findAllByText('Diesel generator'))[0]!.closest('tr, li')!);
    const detail = await screen.findByRole('dialog');
    expect(within(detail).getByText('Oil change')).toBeInTheDocument();

    await user.click(within(detail).getByRole('button', { name: /Record service/ }));
    const dialogs = await screen.findAllByRole('dialog');
    const service = dialogs[dialogs.length - 1]!;
    await user.type(within(service).getByLabelText(/Cost/), '450');
    await user.type(within(service).getByLabelText(/Vendor/), 'Sri Balaji Motors');
    await user.click(within(service).getByRole('button', { name: 'Record service' }));

    await waitFor(() => expect(maint).toHaveLength(1));
    expect(maint[0]).toEqual({
      scheduleId: 's1',
      type: 'SERVICE',
      costPaise: '45000',
      vendor: 'Sri Balaji Motors',
    });
    expect(await screen.findByText('Service recorded — next due date advanced')).toBeInTheDocument();
  });
});
