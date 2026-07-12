import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { SpeciesPanel } from './SpeciesPanel';

const species = [
  { id: 's1', code: 'BROILER', name: 'Broiler chicken', trackingMode: 'BATCH', isSystemDefault: true },
  { id: 's2', code: 'CATTLE', name: 'Cattle', trackingMode: 'INDIVIDUAL', isSystemDefault: true },
];

const detail = {
  ...species[0],
  breeds: [{ id: 'br1', name: 'Cobb 500', isSystemDefault: true }],
  stages: [
    { id: 'st1', name: 'Chick', sequence: 1, isTerminal: false },
    { id: 'st2', name: 'Grower', sequence: 2, isTerminal: true },
  ],
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <SpeciesPanel farmId="f1" />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SpeciesPanel (11.6a rewrite)', () => {
  it('renders the species list as a table', async () => {
    mockFetchRoutes({ '/api/farm/species': () => jsonResponse(200, { species }) });
    renderPanel();
    // DataTable renders desktop table + mobile cards (CSS hides one) → use *AllBy* queries.
    expect((await screen.findAllByText('Broiler chicken')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cattle').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Individual').length).toBeGreaterThan(0);
  });

  it('shows the empty state when there are no species', async () => {
    mockFetchRoutes({ '/api/farm/species': () => jsonResponse(200, { species: [] }) });
    renderPanel();
    expect(await screen.findByText('No species yet')).toBeInTheDocument();
  });

  it('opens the detail dialog with breeds and lifecycle stages on row click', async () => {
    mockFetchRoutes({
      '/api/farm/species': () => jsonResponse(200, { species }),
      '/api/farm/species/s1': () => jsonResponse(200, { species: detail }),
    });
    renderPanel();

    const user = userEvent.setup();
    await user.click((await screen.findAllByText('Broiler chicken'))[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(await screen.findByText('Chick')).toBeInTheDocument();
    expect(screen.getByText('Grower')).toBeInTheDocument();
    expect(screen.getByText('Cobb 500')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Lifecycle stages');
  });
});
