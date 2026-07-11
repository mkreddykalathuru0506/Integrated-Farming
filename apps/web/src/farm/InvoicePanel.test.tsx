import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { InvoicePanel } from './InvoicePanel';

const listInvoice = {
  id: 'i1',
  invoiceNumber: 'INV-2026-27-0001',
  status: 'ISSUED',
  issueDate: '2026-06-20T00:00:00.000Z',
  subtotalPaise: '100000',
  cgstPaise: '0',
  sgstPaise: '0',
  igstPaise: '5000',
  totalPaise: '105000',
  fssaiLicenseNo: '12345678901234',
  customer: { id: 'c1', name: 'Acme Traders' },
};

const detailInvoice = {
  ...listInvoice,
  customer: { id: 'c1', name: 'Acme Traders', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra' },
  placeOfSupplyState: 'Maharashtra',
  notes: null,
  lines: [
    {
      id: 'il1',
      description: 'Broiler box',
      hsnSac: null,
      qty: '10',
      unitPricePaise: '10000',
      gstRateBps: 500,
      taxablePaise: '100000',
      gstPaise: '5000',
      lineTotalPaise: '105000',
      batchId: null,
    },
  ],
};

const batch = {
  id: 'b1',
  code: 'B-001',
  name: null,
  initialCount: 100,
  currentCount: 95,
  status: 'ACTIVE',
  qrCode: null,
  species: { id: 's1', code: 'CHICKEN', name: 'Chicken' },
  breed: null,
  unit: null,
  currentStage: null,
};

function routes(posts: unknown[]) {
  return {
    '/api/farm/invoices': (init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        return jsonResponse(201, { invoice: { ...listInvoice, id: 'i2', invoiceNumber: 'INV-2026-27-0002' } });
      }
      return jsonResponse(200, { items: [listInvoice], total: 1, page: 1, pageSize: 100 });
    },
    '/api/farm/invoices/i1': () => jsonResponse(200, { invoice: detailInvoice }),
    '/api/farm/invoices/pnl/farm': () =>
      jsonResponse(200, { revenuePaise: '5000000', costPaise: '3000000', profitPaise: '2000000' }),
    '/api/farm/customers': () =>
      jsonResponse(200, {
        customers: [{ id: 'c1', name: 'Acme Traders', gstin: null, state: 'Maharashtra' }],
      }),
    '/api/farm': () => jsonResponse(200, { farm: { id: 'f1', name: 'Green Farm', state: 'Telangana', district: null } }),
    '/api/farm/batches': () => jsonResponse(200, { batches: [batch] }),
  };
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <InvoicePanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InvoicePanel (11.6c conversion)', () => {
  it('renders the P&L tiles and the invoice table; row click opens the detail dialog', async () => {
    mockFetchRoutes(routes([]));
    renderPanel();

    // P&L stat card
    expect(await screen.findByText('₹50,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹30,000.00')).toBeInTheDocument();
    expect(screen.getByText('₹20,000.00')).toBeInTheDocument();

    // invoice row: number, customer, status badge, total
    expect((await screen.findAllByText('INV-2026-27-0001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Acme Traders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Issued').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹1,050.00').length).toBeGreaterThan(0);

    // row click → detail via GET /api/farm/invoices/:id
    const user = userEvent.setup();
    await user.click(screen.getAllByText('INV-2026-27-0001')[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Broiler box')).toBeInTheDocument();
    expect(within(dialog).getByText('12345678901234')).toBeInTheDocument(); // FSSAI snapshot
    expect(within(dialog).getByText('27ABCDE1234F1Z5')).toBeInTheDocument(); // customer GSTIN
    expect(within(dialog).getByText('IGST')).toBeInTheDocument(); // inter-state split
    expect(within(dialog).getByRole('button', { name: /PDF/ })).toBeInTheDocument();
  });

  it('builds a multi-line invoice with a live GST estimate mirroring the server split', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes(routes(posts));
    renderPanel();
    expect((await screen.findAllByText('INV-2026-27-0001')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Raise invoice/ }));
    const dialog = await screen.findByRole('dialog');

    // customer (Maharashtra) vs farm (Telangana) → inter-state estimate
    expect(within(dialog).getByText(/Inter-state supply/)).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Description/), 'Broiler crate');
    const qty = within(dialog).getByLabelText(/Qty/);
    await user.clear(qty);
    await user.type(qty, '2');
    await user.type(within(dialog).getByLabelText(/Unit price/), '100');

    // live preview: 2 × ₹100 @5% GST → subtotal ₹200, IGST ₹10, total ₹210
    expect(await within(dialog).findByText('₹200.00')).toBeInTheDocument();
    expect(within(dialog).getByText('₹10.00')).toBeInTheDocument();
    expect(within(dialog).getByText('₹210.00')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Raise invoice' }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      customerId: 'c1',
      lines: [{ description: 'Broiler crate', qty: 2, unitPricePaise: '10000', gstRateBps: 500 }],
    });
    expect(await screen.findByText('Invoice raised')).toBeInTheDocument();
  });
});
