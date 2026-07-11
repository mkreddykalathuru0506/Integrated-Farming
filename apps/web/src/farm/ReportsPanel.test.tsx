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
import { ReportsPanel } from './ReportsPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const schedule = {
  id: 'rs1',
  name: 'Weekly summary',
  frequency: 'WEEKLY',
  format: 'pdf',
  channel: 'WHATSAPP',
  recipient: '+911234567890',
  isActive: true,
  lastRunAt: '2026-07-04T06:00:00.000Z',
  nextRunAt: '2026-07-11T06:00:00.000Z',
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <ReportsPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('ReportsPanel', () => {
  it('renders schedules exposing the previously-dropped fields (channel, active, last/next run)', async () => {
    mockFetchRoutes({
      '/api/farm/reports/schedules': () => jsonResponse(200, { schedules: [schedule] }),
    });
    renderPanel();
    expect((await screen.findAllByText('Weekly summary')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('WhatsApp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+911234567890').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('04-07-2026').length).toBeGreaterThan(0); // lastRunAt, DD-MM-YYYY
    expect(screen.getAllByText('11-07-2026').length).toBeGreaterThan(0); // nextRunAt
  });

  it('run-now posts to the run endpoint and toasts the result', async () => {
    const runs: string[] = [];
    mockFetchRoutes({
      '/api/farm/reports/schedules': () => jsonResponse(200, { schedules: [schedule] }),
      '/api/farm/reports/schedules/rs1/run': () => {
        runs.push('rs1');
        return jsonResponse(200, { delivered: true, bytes: 1024 });
      },
    });
    renderPanel();
    const user = userEvent.setup({ delay: null });
    await user.click((await screen.findAllByRole('button', { name: /Run now/ }))[0]!);
    await waitFor(() => expect(runs).toEqual(['rs1']));
    expect(await screen.findByText('Report generated and delivered')).toBeInTheDocument();
  });

  it('creates a schedule including the channel field', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/reports/schedules': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { schedule: { ...schedule, id: 'rs2' } });
        }
        return jsonResponse(200, { schedules: [] });
      },
    });
    renderPanel();
    expect(await screen.findByText('No scheduled reports')).toBeInTheDocument();

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getAllByRole('button', { name: 'Add schedule' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Daily digest');
    await user.selectOptions(within(dialog).getByLabelText(/Frequency/), 'DAILY');
    await user.selectOptions(within(dialog).getByLabelText(/Channel/), 'SMS');
    await user.type(within(dialog).getByLabelText(/Recipient/), '+919999999999');
    await user.click(within(dialog).getByRole('button', { name: 'Add schedule' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      name: 'Daily digest',
      frequency: 'DAILY',
      format: 'pdf',
      channel: 'SMS',
      recipient: '+919999999999',
    });
    expect(await screen.findByText('Schedule added')).toBeInTheDocument();
  });
});
