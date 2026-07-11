import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { WorkersPanel } from './WorkersPanel';

const worker = {
  id: 'w1',
  name: 'Ramu',
  phone: '9876543210',
  designation: 'Feeder',
  wageType: 'DAILY',
  dailyWageRatePaise: '50000',
  isActive: true,
  userId: null,
};

function routes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/workers': () => jsonResponse(200, { workers: [worker] }),
    '/api/farm/attendance': () => jsonResponse(200, { attendance: [] }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <WorkersPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WorkersPanel (11.6a rewrite)', () => {
  it('renders worker rows with the wage formatted as INR', async () => {
    routes();
    renderPanel();
    // DataTable renders desktop table + mobile cards (CSS hides one) → use *AllBy* queries.
    expect((await screen.findAllByText('Ramu')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹500\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('9876543210').length).toBeGreaterThan(0);
  });

  it('creates a worker with the dormant phone field and paise wage', async () => {
    const posts: unknown[] = [];
    routes({
      '/api/farm/workers': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { worker: { ...worker, id: 'w2', name: 'Shyam' } });
        }
        return jsonResponse(200, { workers: [worker] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Ramu')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add worker' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText(/^Worker name/), 'Shyam');
    await user.type(within(dialog).getByLabelText(/^Phone/), '9000000000');
    await user.type(within(dialog).getByLabelText(/^Wage rate/), '350.50');
    await user.click(within(dialog).getByRole('button', { name: 'Add worker' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      name: 'Shyam',
      phone: '9000000000',
      wageType: 'DAILY',
      dailyWageRatePaise: '35050',
    });
    expect(await screen.findByText('Worker added')).toBeInTheDocument();
  });

  it('marks attendance optimistically from the attendance tab', async () => {
    const posts: { body: unknown }[] = [];
    routes({
      '/api/farm/attendance': (init) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { workerId: string; status: string; date: string };
          posts.push({ body });
          return jsonResponse(201, {
            attendance: { id: 'att1', workerId: body.workerId, date: body.date, status: body.status, notes: null },
          });
        }
        return jsonResponse(200, {
          attendance: posts.length
            ? [{ id: 'att1', workerId: 'w1', date: '2026-07-11', status: 'PRESENT', notes: null }]
            : [],
        });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Ramu')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Attendance' }));

    const presentBtn = await screen.findByRole('button', { name: 'Present' });
    expect(presentBtn).toHaveAttribute('aria-pressed', 'false');
    await user.click(presentBtn);

    // optimistic: pressed immediately, then the POST lands with today's date
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Present' })).toHaveAttribute('aria-pressed', 'true'),
    );
    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0]!.body as { workerId: string; status: string; date: string };
    expect(body.workerId).toBe('w1');
    expect(body.status).toBe('PRESENT');
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // summary chip reflects the optimistic mark
    expect(screen.getByText('1 present')).toBeInTheDocument();
  });
});
