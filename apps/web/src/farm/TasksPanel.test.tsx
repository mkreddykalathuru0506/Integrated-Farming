import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { TasksPanel } from './TasksPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

const task = {
  id: 't1',
  title: 'Morning feeding',
  taskType: 'FEEDING',
  dueDate: '2026-07-11T00:00:00.000Z',
  status: 'PENDING',
  completedAt: null,
  templateId: null,
};

function routes(overrides: Record<string, RouteHandler> = {}) {
  return mockFetchRoutes({
    '/api/farm/tasks': () => jsonResponse(200, { tasks: [task] }),
    '/api/farm/schedules': () => jsonResponse(200, { schedules: [] }),
    '/api/farm/units': () => jsonResponse(200, { units: [] }),
    '/api/farm/workers': () => jsonResponse(200, { workers: [] }),
    ...overrides,
  });
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <TasksPanel farmId="f1" canWrite />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TasksPanel (11.6a rewrite)', () => {
  it('renders tasks and completes one optimistically', async () => {
    const completes: string[] = [];
    routes({
      '/api/farm/tasks/t1/complete': (init) => {
        if (init?.method === 'POST') {
          completes.push('t1');
          return jsonResponse(200, {
            task: { ...task, status: 'DONE', completedAt: new Date().toISOString() },
          });
        }
        return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
      },
    });
    renderPanel();
    // DataTable renders desktop table + mobile cards (CSS hides one) → use *AllBy* queries.
    expect((await screen.findAllByText('Morning feeding')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Mark "Morning feeding" as done' })[0]!);

    await waitFor(() => expect(completes).toEqual(['t1']));
    expect(await screen.findByText('Task completed')).toBeInTheDocument();
    expect((await screen.findAllByText('Done')).length).toBeGreaterThan(0);
  });

  it('generates tasks and toasts the result counts', async () => {
    routes({
      '/api/farm/tasks/generate': () => jsonResponse(200, { generated: 3, missed: 1 }),
    });
    renderPanel();
    expect((await screen.findAllByText('Morning feeding')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Generate/ }));
    expect(await screen.findByText('Generated 3 task(s), swept 1 missed')).toBeInTheDocument();
  });

  it('lists schedules and creates one from the dialog', async () => {
    const posts: unknown[] = [];
    routes({
      '/api/farm/schedules': (init) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return jsonResponse(201, {
            schedule: { id: 'sc1', name: 'Morning feed', taskType: 'FEEDING', frequency: 'DAILY', isActive: true },
          });
        }
        return jsonResponse(200, { schedules: [] });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Morning feeding')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Schedules' }));
    expect(await screen.findByText('No recurring schedules yet')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Add schedule' })[0]!);
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText(/^Schedule name/), 'Morning feed');
    await user.type(within(dialog).getByLabelText(/^Time of day/), '06:30');
    await user.click(within(dialog).getByRole('button', { name: 'Add schedule' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      name: 'Morning feed',
      taskType: 'FEEDING',
      frequency: 'DAILY',
      timeOfDay: '06:30',
    });
    expect(await screen.findByText('Schedule added')).toBeInTheDocument();
  });
});

describe('TasksPanel assignee (slice 11.9)', () => {
  const worker = {
    id: 'w1',
    name: 'Ravi',
    phone: null,
    designation: null,
    wageType: 'DAILY',
    dailyWageRatePaise: null,
    isActive: true,
    userId: null,
  };

  it('assigns a task to a worker via the row picker (PATCH { workerId })', async () => {
    const patches: unknown[] = [];
    routes({
      '/api/farm/workers': () => jsonResponse(200, { workers: [worker] }),
      '/api/farm/tasks/t1/assign': (init) => {
        patches.push({ method: init?.method, body: JSON.parse(String(init?.body)) });
        return jsonResponse(200, { task: { ...task, assignedWorkerId: 'w1' } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Morning feeding')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.selectOptions(
      screen.getAllByLabelText('Assign "Morning feeding" to a worker')[0]!,
      'w1',
    );

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ method: 'PATCH', body: { workerId: 'w1' } });
    expect(await screen.findByText('Task assignment updated')).toBeInTheDocument();
  });

  it('unassigns with workerId null and filters by ?assigneeId= including the none sentinel', async () => {
    const urls: string[] = [];
    const patches: unknown[] = [];
    routes({
      '/api/farm/tasks': (_init, url) => {
        urls.push(url);
        return jsonResponse(200, { tasks: [{ ...task, assignedWorkerId: 'w1' }] });
      },
      '/api/farm/workers': () => jsonResponse(200, { workers: [worker] }),
      '/api/farm/tasks/t1/assign': (init) => {
        patches.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { task: { ...task, assignedWorkerId: null } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Morning feeding')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    // picking the blank option unassigns → { workerId: null }
    await user.selectOptions(
      screen.getAllByLabelText('Assign "Morning feeding" to a worker')[0]!,
      '',
    );
    await waitFor(() => expect(patches).toEqual([{ workerId: null }]));

    // the unassigned view uses the API's literal 'none' sentinel
    await user.selectOptions(screen.getByLabelText('Filter by assignee'), 'none');
    await waitFor(() =>
      expect(urls.some((u) => new URL(u).searchParams.get('assigneeId') === 'none')).toBe(true),
    );

    // and a worker filter passes the id through verbatim
    await user.selectOptions(screen.getByLabelText('Filter by assignee'), 'w1');
    await waitFor(() =>
      expect(urls.some((u) => new URL(u).searchParams.get('assigneeId') === 'w1')).toBe(true),
    );
  });
});
