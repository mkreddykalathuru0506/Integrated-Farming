import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { EmiInsurancePanel } from './EmiInsurancePanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();

const loan = {
  id: 'l1',
  lender: 'NABARD',
  principalPaise: '50000000',
  emiAmountPaise: '450000',
  startDate: '2026-01-01T00:00:00.000Z',
  nextDueDate: soon,
  status: 'ACTIVE',
};

const policy = {
  id: 'p1',
  provider: 'AIC',
  type: 'LIVESTOCK',
  premiumPaise: '120000',
  endDate: soon,
  status: 'ACTIVE',
  policyNumber: 'POL-42',
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <EmiInsurancePanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EmiInsurancePanel (11.6c conversion)', () => {
  it('renders loans with a due-soon badge, the reminder strip, and the insurance tab', async () => {
    mockFetchRoutes({
      '/api/farm/loans': () => jsonResponse(200, { loans: [loan] }),
      '/api/farm/insurance': () => jsonResponse(200, { policies: [policy] }),
      '/api/farm/finance/reminders': () =>
        jsonResponse(200, { emiDue: [loan], policiesExpiring: [policy] }),
    });
    renderPanel();

    expect((await screen.findAllByText('NABARD')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹5,00,000.00').length).toBeGreaterThan(0); // principal
    expect(screen.getAllByText('Due soon').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 EMI due soon/)).toBeInTheDocument(); // reminders strip

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Insurance' }));
    expect((await screen.findAllByText('AIC')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('POL-42').length).toBeGreaterThan(0); // dormant field now shown
    expect(screen.getAllByText('Expiring soon').length).toBeGreaterThan(0);
  });

  it('adds a loan with a backdated start date (paise strings end-to-end)', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/loans': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { loan: { ...loan, id: 'l2', lender: 'SBI' } });
        }
        return jsonResponse(200, { loans: [] });
      },
      '/api/farm/insurance': () => jsonResponse(200, { policies: [] }),
      '/api/farm/finance/reminders': () => jsonResponse(200, { emiDue: [], policiesExpiring: [] }),
    });
    renderPanel();
    expect(await screen.findByText('No loans yet')).toBeInTheDocument();

    const user = userEvent.setup();
    // header action + EmptyState CTA both say "Add loan" — either opens the dialog
    await user.click(screen.getAllByRole('button', { name: 'Add loan' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Lender/), 'SBI');
    await user.type(within(dialog).getByLabelText(/Principal/), '5,000.50');
    // dormant API field: backdatable startDate (was hardcoded to "now" before 11.6c)
    fireEvent.change(within(dialog).getByLabelText(/Start date/), { target: { value: '2026-01-15' } });
    await user.click(within(dialog).getByRole('button', { name: 'Add loan' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      lender: 'SBI',
      principalPaise: '500050', // Indian-grouped rupee text → integer-paise string
      startDate: '2026-01-15T00:00:00.000Z',
    });
    expect(await screen.findByText('Loan added')).toBeInTheDocument();
  });
});
