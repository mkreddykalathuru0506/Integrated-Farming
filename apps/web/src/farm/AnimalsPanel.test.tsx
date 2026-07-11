import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { AnimalsPanel } from './AnimalsPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const animal = {
  id: 'a1',
  tagNumber: 'COW-001',
  qrCode: 'IFM-A-1',
  name: 'Ganga',
  sex: 'FEMALE',
  dob: null,
  status: 'ACTIVE',
  species: { id: 's2', code: 'CATTLE', name: 'Cattle' },
  breed: null,
  unit: null,
  currentStage: { id: 'st1', name: 'Calf', sequence: 1, isTerminal: false },
};

const species = [
  { id: 's2', code: 'CATTLE', name: 'Cattle', trackingMode: 'INDIVIDUAL', isSystemDefault: true },
];

function routes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/animals': () => jsonResponse(200, { animals: [animal] }),
    '/api/farm/species': () => jsonResponse(200, { species }),
    '/api/farm/species/s2': () => jsonResponse(200, { species: { ...species[0], breeds: [], stages: [] } }),
    '/api/farm/units': () => jsonResponse(200, { units: [] }),
    '/api/farm/movements': () => jsonResponse(200, { movements: [] }),
    '/api/farm/mortality': () => jsonResponse(200, { events: [] }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <AnimalsPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnimalsPanel (11.6a rewrite)', () => {
  it('renders animal rows', async () => {
    routes();
    renderPanel();
    // DataTable renders desktop table + mobile cards (CSS hides one) → use *AllBy* queries.
    expect((await screen.findAllByText('COW-001')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cattle').length).toBeGreaterThan(0);
  });

  // Generous timeout: dialog + several user.type() calls are slow under jsdom.
  it('creates an animal from the dialog with the dormant name/dob fields', { timeout: 20000 }, async () => {
    const posts: unknown[] = [];
    routes({
      '/api/farm/animals': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { animal: { ...animal, id: 'a2', tagNumber: 'COW-002' } });
        }
        return jsonResponse(200, { animals: [animal] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('COW-001')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add animal' }));
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText(/^Species/), 's2');
    await user.type(within(dialog).getByLabelText(/^Ear-tag number/), 'COW-002');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Yamuna');
    await user.type(within(dialog).getByLabelText(/^Date of birth/), '2025-06-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add animal' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      speciesId: 's2',
      tagNumber: 'COW-002',
      name: 'Yamuna',
      sex: 'UNKNOWN',
      dob: '2025-06-01T00:00:00.000Z',
    });
    expect(await screen.findByText('Animal added')).toBeInTheDocument();
  });

  it('QR print renders a hostile tagNumber as TEXT — no element injection (stored XSS guard)', async () => {
    const payload = '<img src=x onerror="window.__pwned=true">';
    const hostile = { ...animal, id: 'a9', tagNumber: payload, qrCode: 'IFM-A-9' };
    routes({ '/api/farm/animals': () => jsonResponse(200, { animals: [hostile] }) });

    // Fake popup window backed by a real detached document (never attached to jsdom's DOM).
    const popupDoc = document.implementation.createHTMLDocument('popup');
    const popup = {
      document: popupDoc,
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    renderPanel();
    const user = userEvent.setup();
    await user.click((await screen.findAllByLabelText(`Show QR for ${payload}`))[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Print' }));

    expect(openSpy).toHaveBeenCalled();
    expect((popup as { print: ReturnType<typeof vi.fn> }).print).toHaveBeenCalled();
    // The payload must appear as literal text…
    expect(popupDoc.body.textContent).toContain(payload);
    // …and must NOT have been parsed into an element (the classic XSS sink).
    expect(popupDoc.querySelector('img')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    openSpy.mockRestore();
  });

  it('gates cull behind ConfirmDialog from the detail dialog', async () => {
    const posts: unknown[] = [];
    routes({
      '/api/farm/mortality': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { event: { id: 'm1' }, animalStatus: 'CULLED' });
        }
        return jsonResponse(200, { events: [] });
      },
    });
    renderPanel();

    const user = userEvent.setup();
    await user.click((await screen.findAllByText('COW-001'))[0]!);

    // detail dialog shows the movement history section
    expect(await screen.findByText('Movement history')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cull' }));
    expect(await screen.findByText('Record culling')).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    const confirmDialog = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryByText('Record culling'))!;
    await user.click(within(confirmDialog).getByRole('button', { name: 'Record loss' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ animalId: 'a1', type: 'CULL' });
    expect(await screen.findByText('Loss recorded')).toBeInTheDocument();
  });
});
