import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { VaccinationPanel } from './VaccinationPanel';

const batch = {
  id: 'b1',
  code: 'B-001',
  name: 'Broilers A',
  initialCount: 100,
  currentCount: 95,
  status: 'ACTIVE',
  qrCode: null,
  species: { id: 's1', code: 'CHICKEN', name: 'Chicken' },
  breed: null,
  unit: null,
  currentStage: null,
};

const schedule = {
  ageDays: 10,
  due: [{ id: 'v1', vaccineName: 'Lasota', type: 'VACCINE', ageDays: 7 }],
  upcoming: [{ id: 'v2', vaccineName: 'Gumboro', type: 'VACCINE', ageDays: 21 }],
  done: [{ id: 'v0', vaccineName: 'Marek', type: 'VACCINE', ageDays: 1 }],
};

function baseRoutes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/batches': () => jsonResponse(200, { batches: [batch] }),
    '/api/farm/health/vaccinations': () => jsonResponse(200, schedule),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <VaccinationPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VaccinationPanel (schedule timeline)', () => {
  it('renders the timeline with due / done / upcoming states and a labelled batch picker', async () => {
    baseRoutes();
    renderPanel();

    // batch picker shows name + code + current count, not a bare code
    expect(await screen.findByRole('option', { name: 'Broilers A (B-001) · 95' })).toBeInTheDocument();

    expect(await screen.findByText('Lasota')).toBeInTheDocument();
    expect(screen.getByText('Due · day 7')).toBeInTheDocument();
    expect(screen.getByText('Marek')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Gumboro')).toBeInTheDocument();
    expect(screen.getByText('in 11 days')).toBeInTheDocument();
    expect(screen.getByText('Batch age: 10 days')).toBeInTheDocument();
  });

  it('records a due vaccination (with its scheduleItemId) and toasts', async () => {
    const posts: unknown[] = [];
    baseRoutes({
      '/api/farm/health/vaccinations': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, { event: { id: 'e1' } });
        }
        return jsonResponse(200, schedule);
      },
    });
    renderPanel();
    expect(await screen.findByText('Lasota')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mark given' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ batchId: 'b1', vaccineName: 'Lasota', scheduleItemId: 'v1' });
    expect(await screen.findByText('Vaccination recorded')).toBeInTheDocument();
  });
});
