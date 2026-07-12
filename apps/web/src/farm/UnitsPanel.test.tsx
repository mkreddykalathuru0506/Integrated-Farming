import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { UnitsPanel } from './UnitsPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const makeUnit = (id: string, name: string) => ({
  id,
  name,
  type: 'POULTRY',
  code: null,
  isActive: true,
  createdAt: '2026-07-11T00:00:00.000Z',
});

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <UnitsPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UnitsPanel (TanStack Query reference conversion)', () => {
  it('renders the fetched unit list', async () => {
    mockFetchRoutes({
      '/api/farm/units': () => jsonResponse(200, { units: [makeUnit('u1', 'Shed A')] }),
    });
    renderPanel();
    expect(await screen.findByText(/Shed A/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no units', async () => {
    mockFetchRoutes({ '/api/farm/units': () => jsonResponse(200, { units: [] }) });
    renderPanel();
    expect(await screen.findByText('No units yet')).toBeInTheDocument();
  });

  it('creates a unit via the API, invalidates the list and toasts success', async () => {
    const units = [makeUnit('u1', 'Shed A')];
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farm/units': (init) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { name: string; type: string };
          posts.push({ body, farm: new Headers(init.headers).get('X-Farm-Id') });
          units.push(makeUnit('u2', body.name));
          return jsonResponse(201, { unit: units[units.length - 1] });
        }
        return jsonResponse(200, { units: [...units] });
      },
    });
    renderPanel();
    expect(await screen.findByText(/Shed A/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Unit name (e.g. Poultry Shed 1)'), 'Shed B');
    await user.click(screen.getByRole('button', { name: 'Add unit' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ body: { name: 'Shed B', type: 'POULTRY' }, farm: 'f1' });
    // invalidation refetches the list → the new unit appears
    expect(await screen.findByText(/Shed B/)).toBeInTheDocument();
    // success toast from the useApiMutation wrapper
    expect(await screen.findByText('Unit added')).toBeInTheDocument();
  });

  it('deletes a unit only after ConfirmDialog confirmation', async () => {
    let units = [makeUnit('u1', 'Shed A')];
    const deletes: string[] = [];
    mockFetchRoutes({
      '/api/farm/units/u1': (init) => {
        if (init?.method === 'DELETE') {
          deletes.push('u1');
          units = [];
          return jsonResponse(200, { ok: true });
        }
        return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
      },
      '/api/farm/units': () => jsonResponse(200, { units: [...units] }),
    });
    renderPanel();
    expect(await screen.findByText(/Shed A/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // dialog opens; nothing deleted yet
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete unit');
    expect(dialog).toHaveTextContent('Shed A');
    expect(deletes).toHaveLength(0);

    // cancel closes without deleting
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deletes).toHaveLength(0);

    // confirm actually deletes + toasts + refetches
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deletes).toEqual(['u1']));
    expect(await screen.findByText('Unit deleted')).toBeInTheDocument();
    expect(await screen.findByText('No units yet')).toBeInTheDocument();
  });
});
