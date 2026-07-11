import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { BreedingPanel } from './BreedingPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const record = {
  id: 'r1',
  speciesId: 's1',
  damId: null,
  sireId: null,
  method: 'AI',
  breedingDate: '2026-06-01T00:00:00.000Z',
  expectedDueDate: '2027-03-10T00:00:00.000Z',
  status: 'PLANNED',
  offspringCount: null,
};

function baseRoutes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/breeding': () => jsonResponse(200, { records: [record] }),
    '/api/farm/species': () =>
      jsonResponse(200, {
        species: [{ id: 's1', code: 'COW', name: 'Cow', trackingMode: 'INDIVIDUAL', isSystemDefault: true }],
      }),
    '/api/farm/animals': () => jsonResponse(200, { animals: [] }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <BreedingPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BreedingPanel (records table + status flow)', () => {
  it('renders records with species, method, formatted dates and a status badge', async () => {
    baseRoutes();
    renderPanel();

    expect((await screen.findAllByText('Cow')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Artificial insemination')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('01-06-2026')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('10-03-2027')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Planned')).length).toBeGreaterThan(0);
  });

  it('creates a record via the dialog with method + species', async () => {
    const posts: unknown[] = [];
    baseRoutes({
      '/api/farm/breeding': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { record: { ...record, id: 'r2' } });
        }
        return jsonResponse(200, { records: [record] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Cow')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Record breeding/ }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/Method/), 'AI');
    await user.click(within(dialog).getByRole('button', { name: 'Record breeding' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    const body = posts[0] as { speciesId: string; method: string; breedingDate: string };
    expect(body.speciesId).toBe('s1');
    expect(body.method).toBe('AI');
    expect(body.breedingDate).toMatch(/T00:00:00\.000Z$/);
    expect(await screen.findByText('Breeding recorded')).toBeInTheDocument();
  });

  it('completes a breeding capturing the offspring count', async () => {
    const patches: { url: string; body: unknown }[] = [];
    baseRoutes({
      '/api/farm/breeding/r1': (init, url) => {
        patches.push({ url, body: JSON.parse(String(init?.body)) });
        return jsonResponse(200, { record: { ...record, status: 'COMPLETED', offspringCount: 3 } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Cow')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Complete' })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Offspring count/), '3');
    await user.click(within(dialog).getByRole('button', { name: 'Complete' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]!.body).toEqual({ status: 'COMPLETED', offspringCount: 3 });
    expect(await screen.findByText('Breeding updated')).toBeInTheDocument();
  });

  it('marks failed only after ConfirmDialog confirmation', async () => {
    const patches: unknown[] = [];
    baseRoutes({
      '/api/farm/breeding/r1': (init) => {
        patches.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { record: { ...record, status: 'FAILED' } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Cow')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Failed' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Mark breeding as failed?');
    expect(patches).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Failed' }));
    await waitFor(() => expect(patches).toEqual([{ status: 'FAILED' }]));
  });
});
