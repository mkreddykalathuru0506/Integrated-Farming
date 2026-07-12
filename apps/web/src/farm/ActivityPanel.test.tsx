import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { ActivityPanel } from './ActivityPanel';

vi.setConfig({ testTimeout: 20_000 });

const item = (id: string, action: string, entity: string, createdAt: string, user: { id: string; name: string } | null) => ({
  id,
  action,
  entity,
  entityId: null,
  ip: null,
  createdAt,
  user,
});

function renderPanel(canView = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <ActivityPanel farmId="f1" canView={canView} />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ActivityPanel (slice 11.9)', () => {
  it('renders humanized rows grouped by day, with the user name or "system"', async () => {
    mockFetchRoutes({
      '/api/farm/audit': () =>
        jsonResponse(200, {
          items: [
            item('a1', 'expenses.update', 'Expenses', '2026-07-10T04:30:00.000Z', { id: 'u1', name: 'Asha' }),
            item('a2', 'batches.advance', 'Batches', '2026-07-09T04:30:00.000Z', null),
          ],
          nextCursor: null,
        }),
    });
    renderPanel();

    // humanized labels: entity · verb
    expect(await screen.findByText('Expenses · updated')).toBeInTheDocument();
    expect(screen.getByText('Batches · stage advanced')).toBeInTheDocument();
    // user name and the system fallback
    expect(screen.getByText(/Asha/)).toBeInTheDocument();
    expect(screen.getByText(/system/)).toBeInTheDocument();
    // grouped under two IST day headers
    expect(screen.getByText('10-07-2026')).toBeInTheDocument();
    expect(screen.getByText('09-07-2026')).toBeInTheDocument();
    // everything loaded → no Load more
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('follows nextCursor: Load more re-requests with ?cursor=<last id>', async () => {
    const urls: string[] = [];
    mockFetchRoutes({
      '/api/farm/audit': (_init, url) => {
        urls.push(url);
        const cursor = new URL(url).searchParams.get('cursor');
        return cursor === null
          ? jsonResponse(200, {
              items: [item('a1', 'members.create', 'Members', '2026-07-10T04:30:00.000Z', { id: 'u1', name: 'Asha' })],
              nextCursor: 'a1',
            })
          : jsonResponse(200, {
              items: [item('a0', 'farm.update', 'Farm', '2026-07-08T04:30:00.000Z', { id: 'u1', name: 'Asha' })],
              nextCursor: null,
            });
      },
    });
    renderPanel();

    expect(await screen.findByText('Members · created')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Farm · updated')).toBeInTheDocument();
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(new URL(urls[1]!).searchParams.get('cursor')).toBe('a1');
    // both pages accumulate; the button disappears once nextCursor is null
    expect(screen.getByText('Members · created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('passes the entity filter to the server and gates the verb filter on it', async () => {
    const urls: string[] = [];
    mockFetchRoutes({
      '/api/farm/audit': (_init, url) => {
        urls.push(url);
        return jsonResponse(200, { items: [], nextCursor: null });
      },
    });
    renderPanel();
    await screen.findByText('No activity yet');

    const user = userEvent.setup();
    const entitySelect = screen.getByLabelText('Filter by area');
    expect(screen.getByLabelText('Filter by action')).toBeDisabled();

    await user.selectOptions(entitySelect, 'Expenses');
    await waitFor(() =>
      expect(urls.some((u) => new URL(u).searchParams.get('entity') === 'Expenses')).toBe(true),
    );

    const verbSelect = screen.getByLabelText('Filter by action');
    expect(verbSelect).toBeEnabled();
    await user.selectOptions(verbSelect, 'update');
    await waitFor(() =>
      expect(urls.some((u) => new URL(u).searchParams.get('action') === 'expenses.update')).toBe(true),
    );
  });

  it('renders a friendly note instead of the feed for roles without audit access', () => {
    mockFetchRoutes({});
    renderPanel(false);
    expect(screen.getByText('Only the owner and managers can view the activity log.')).toBeInTheDocument();
  });
});
