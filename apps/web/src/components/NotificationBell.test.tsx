import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { NotificationBell } from './NotificationBell';
import type { Role } from './nav';

const EMPTY_DUE = {
  days: 7,
  counts: { vaccinations: 0, maintenance: 0, emi: 0, insurance: 0, tasks: 0 },
  vaccinations: [],
  maintenance: [],
  emiDue: [],
  policiesExpiring: [],
  tasksToday: [],
};

const RISK = {
  id: 'r1',
  type: 'PRICE_DROP',
  severity: 'CRITICAL',
  reason: 'Broiler price dropped 30%',
  status: 'OPEN',
  createdAt: new Date(Date.now() - 3_600_000).toISOString(), // an hour ago
};

function renderBell(role: Role = 'OWNER', onNavigate = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <NotificationBell role={role} onNavigate={onNavigate} />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onNavigate;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NotificationBell', () => {
  it('shows the unread badge from open risks + due items', async () => {
    mockFetchRoutes({
      '/api/farm/risk': () => jsonResponse(200, { risks: [RISK] }),
      '/api/farm/due': () =>
        jsonResponse(200, {
          ...EMPTY_DUE,
          emiDue: [{ id: 'l1', lender: 'NABARD', nextDueDate: new Date().toISOString() }],
        }),
    });
    renderBell();
    expect(await screen.findByLabelText('2 unread notifications')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opening marks all seen (persisted per farm) and clears the badge', async () => {
    mockFetchRoutes({
      '/api/farm/risk': () => jsonResponse(200, { risks: [RISK] }),
      '/api/farm/due': () => jsonResponse(200, EMPTY_DUE),
    });
    renderBell();
    const trigger = await screen.findByLabelText('1 unread notifications');

    const user = userEvent.setup();
    await user.click(trigger);
    expect(await screen.findByText('Broiler price dropped 30%')).toBeInTheDocument();
    expect(localStorage.getItem('ifm.bell.lastSeen.f1')).toBeTruthy();

    // badge cleared: the trigger label falls back to the plain title
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('clicking an item deep-links via onNavigate', async () => {
    mockFetchRoutes({
      '/api/farm/risk': () => jsonResponse(200, { risks: [RISK] }),
      '/api/farm/due': () => jsonResponse(200, EMPTY_DUE),
    });
    const onNavigate = renderBell();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('1 unread notifications'));
    await user.click(await screen.findByText('Broiler price dropped 30%'));
    expect(onNavigate).toHaveBeenCalledWith({ key: 'intelligence' });
  });

  it('acknowledges a risk inline (OWNER) with a toast', async () => {
    const acks: string[] = [];
    mockFetchRoutes({
      '/api/farm/risk': () => jsonResponse(200, { risks: [RISK] }),
      '/api/farm/due': () => jsonResponse(200, EMPTY_DUE),
      '/api/farm/risk/r1/ack': (init) => {
        if (init?.method === 'POST') {
          acks.push('r1');
          return jsonResponse(200, { risk: { ...RISK, status: 'ACKNOWLEDGED' } });
        }
        return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
      },
    });
    renderBell('OWNER');
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('1 unread notifications'));
    await user.click(await screen.findByLabelText('Acknowledge'));
    await waitFor(() => expect(acks).toEqual(['r1']));
    expect(await screen.findByText('Alert acknowledged')).toBeInTheDocument();
  });

  it('hides the ack control for non-managing roles', async () => {
    mockFetchRoutes({
      '/api/farm/risk': () => jsonResponse(200, { risks: [RISK] }),
      '/api/farm/due': () => jsonResponse(200, EMPTY_DUE),
    });
    renderBell('LABOUR');
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('1 unread notifications'));
    expect(await screen.findByText('Broiler price dropped 30%')).toBeInTheDocument();
    expect(screen.queryByLabelText('Acknowledge')).not.toBeInTheDocument();
  });

  it('shows the friendly empty state when nothing is due', async () => {
    mockFetchRoutes({
      '/api/farm/risk': () => jsonResponse(200, { risks: [] }),
      '/api/farm/due': () => jsonResponse(200, EMPTY_DUE),
    });
    renderBell();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Notifications'));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});
