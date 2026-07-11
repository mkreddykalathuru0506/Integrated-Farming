import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { __clearQueue } from '../offline/queue';
import { DailyLogPanel } from './DailyLogPanel';

const batch = {
  id: 'b1',
  code: 'BR-2026-01',
  name: null,
  initialCount: 100,
  currentCount: 97,
  status: 'ACTIVE',
  qrCode: 'IFM-B-1',
  species: { id: 's1', code: 'BROILER', name: 'Broiler chicken' },
  breed: null,
  unit: null,
  currentStage: null,
};

const log = {
  id: 'l1',
  type: 'FEED',
  quantity: 20,
  unit: 'kg',
  loggedAt: '2026-07-10T04:30:00.000Z',
  batchId: 'b1',
  clientLogId: 'c1',
};

function routes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/batches': () => jsonResponse(200, { batches: [batch] }),
    '/api/farm/logs': () => jsonResponse(200, { items: [log], total: 1, page: 1, pageSize: 100 }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <DailyLogPanel farmId="f1" />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await __clearQueue();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DailyLogPanel (11.6a rewrite, offline queue intact)', () => {
  it('renders recent logs with the batch code resolved', async () => {
    routes();
    renderPanel();
    expect(await screen.findByText('BR-2026-01', { selector: 'option' })).toBeInTheDocument();
    const recent = await screen.findByTestId('log-recent');
    await waitFor(() => expect(recent).toHaveTextContent('Feed'));
    expect(recent).toHaveTextContent('20');
  });

  it('logs via the offline queue: POST carries a clientLogId and the form clears', async () => {
    const posts: Record<string, unknown>[] = [];
    routes({
      '/api/farm/logs': (init) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          posts.push(body);
          return jsonResponse(201, { log: { ...log, id: 'l2', ...body } });
        }
        return jsonResponse(200, { items: [log], total: 1, page: 1, pageSize: 100 });
      },
    });
    renderPanel();

    const qty = await screen.findByTestId('log-qty');
    const user = userEvent.setup();
    await user.type(qty, '15');
    await user.click(screen.getByTestId('log-submit'));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ type: 'FEED', batchId: 'b1', quantity: 15, unit: 'kg' });
    expect(typeof posts[0]!.clientLogId).toBe('string');
    // queue drained → no pending chip, input cleared
    await waitFor(() => expect(screen.queryByTestId('log-pending')).not.toBeInTheDocument());
    expect((screen.getByTestId('log-qty') as HTMLInputElement).value).toBe('');
  });

  it('keeps the entry queued and shows the pending chip when the POST fails (offline)', async () => {
    routes({
      '/api/farm/logs': (init) => {
        if (init?.method === 'POST') throw new TypeError('network down');
        return jsonResponse(200, { items: [log], total: 1, page: 1, pageSize: 100 });
      },
    });
    renderPanel();

    const qty = await screen.findByTestId('log-qty');
    const user = userEvent.setup();
    await user.type(qty, '7');
    await user.click(screen.getByTestId('log-submit'));

    expect(await screen.findByTestId('log-pending')).toHaveTextContent('1 to sync');
  });

  it('parks a permanently-rejected (4xx) entry as a failed item with a discard control', async () => {
    routes({
      '/api/farm/logs': (init) => {
        if (init?.method === 'POST') {
          return jsonResponse(422, { error: { code: 'INVALID_TARGET', message: 'wrong farm' } });
        }
        return jsonResponse(200, { items: [log], total: 1, page: 1, pageSize: 100 });
      },
    });
    renderPanel();

    const qty = await screen.findByTestId('log-qty');
    const user = userEvent.setup();
    await user.type(qty, '9');
    await user.click(screen.getByTestId('log-submit'));

    // Poison surfaces in the failed area; it is NOT a pending item.
    const failed = await screen.findByTestId('log-failed');
    expect(failed).toHaveTextContent('1 could not sync');
    expect(screen.queryByTestId('log-pending')).not.toBeInTheDocument();

    // Discard clears it.
    await user.click(within(failed).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByTestId('log-failed')).not.toBeInTheDocument());
  });
});
