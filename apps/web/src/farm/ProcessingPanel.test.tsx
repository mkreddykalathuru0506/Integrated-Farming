import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { ProcessingPanel } from './ProcessingPanel';

// Dialog-heavy userEvent flows can exceed the 5s default on loaded CI runners.
vi.setConfig({ testTimeout: 20_000 });

const lot = {
  id: 'l1',
  lotCode: 'IFM-L-l1',
  qrCode: 'IFM-L-l1',
  productName: 'Whole dressed chicken',
  state: 'FROZEN',
  initialQuantityKg: '30',
  quantityKg: '20',
  status: 'AVAILABLE',
  producedAt: '2026-07-05T00:00:00.000Z',
  expiryDate: null,
  coldStorageId: null,
  sourceBatchId: 'b1',
  sourceBatch: { id: 'b1', code: 'B-001', species: { name: 'Chicken (Broiler)' } },
  coldStorage: null,
};

const batch = {
  id: 'b1',
  code: 'B-001',
  name: null,
  initialCount: 120,
  currentCount: 100,
  status: 'ACTIVE',
  qrCode: 'IFM-B-b1',
  species: { id: 'sp1', code: 'CHK', name: 'Chicken (Broiler)' },
  breed: null,
  unit: null,
  currentStage: null,
};

const baseRoutes: Record<string, RouteHandler> = {
  '/api/farm/batches': () => jsonResponse(200, { batches: [batch] }),
  '/api/farm/coldstorage': () => jsonResponse(200, { stores: [] }),
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <ProcessingPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillAndSubmitProcessingForm(qty: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Process batch' }));
  const dialog = await screen.findByRole('dialog');
  await user.selectOptions(within(dialog).getByLabelText(/Source batch/), 'b1');
  await user.type(within(dialog).getByLabelText(/Product name/), 'Chicken curry cut');
  await user.type(within(dialog).getByLabelText(/Qty \(kg\)/), qty);
  await user.click(within(dialog).getByRole('button', { name: 'Process' }));
  return dialog;
}

describe('ProcessingPanel', () => {
  it('renders the lots table with remaining/initial kg and status badge', async () => {
    mockFetchRoutes({ ...baseRoutes, '/api/farm/lots': () => jsonResponse(200, { lots: [lot] }) });
    renderPanel();
    expect((await screen.findAllByText('IFM-L-l1')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('20 / 30').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
  });

  it('creates a processing run (POST body has source batch + output lots)', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/lots': () => jsonResponse(200, { lots: [lot] }),
      '/api/farm/processing': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { run: { id: 'r1' } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('IFM-L-l1')).length).toBeGreaterThan(0);

    await fillAndSubmitProcessingForm('12');

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      sourceBatchId: 'b1',
      lots: [{ productName: 'Chicken curry cut', state: 'FROZEN', quantityKg: 12 }],
    });
    expect(await screen.findByText('Processing recorded — lots created')).toBeInTheDocument();
  });

  it('surfaces the withdrawal hard gate as a prominent in-dialog explanation', async () => {
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/lots': () => jsonResponse(200, { lots: [lot] }),
      '/api/farm/processing': () =>
        jsonResponse(422, {
          error: { code: 'WITHDRAWAL_ACTIVE', message: 'Cannot process: batch is under a medication withdrawal period' },
        }),
    });
    renderPanel();
    expect((await screen.findAllByText('IFM-L-l1')).length).toBeGreaterThan(0);

    const dialog = await fillAndSubmitProcessingForm('12');

    expect(await within(dialog).findByText('Blocked: medication withdrawal active')).toBeInTheDocument();
    expect(within(dialog).getByText(/withdrawal period has not elapsed/)).toBeInTheDocument();
  });

  it('row click opens the lot detail with QR and the provenance trace', async () => {
    mockFetchRoutes({
      ...baseRoutes,
      '/api/farm/lots': () => jsonResponse(200, { lots: [lot] }),
      '/api/farm/lots/l1/trace': () =>
        jsonResponse(200, {
          lot: { id: 'l1', lotCode: 'IFM-L-l1', productName: 'Whole dressed chicken', state: 'FROZEN', quantityKg: '20', producedAt: '2026-07-05T00:00:00.000Z' },
          coldStorage: null,
          processingRun: { id: 'r1', processedAt: '2026-07-05T00:00:00.000Z', inputCount: 20 },
          sourceBatch: { id: 'b1', code: 'B-001', qrCode: 'IFM-B-b1', species: { id: 'sp1', name: 'Chicken (Broiler)' }, breed: null },
        }),
    });
    renderPanel();
    const cells = await screen.findAllByText('IFM-L-l1');
    const user = userEvent.setup();
    await user.click(cells[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Lot IFM-L-l1');
    // Trace timeline: run → source batch → species
    expect(await within(dialog).findByText('B-001')).toBeInTheDocument();
    expect(within(dialog).getByText('Chicken (Broiler)')).toBeInTheDocument();
    expect(within(dialog).getByText('20 animals in')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Print label' })).toBeInTheDocument();
  });
});
