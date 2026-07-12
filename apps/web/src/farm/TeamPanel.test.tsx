import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { TeamPanel } from './TeamPanel';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load.
vi.setConfig({ testTimeout: 20_000 });

const members = [
  { id: 'm1', userId: 'u1', name: 'Owner One', email: 'owner@example.com', role: 'OWNER', status: 'ACTIVE' },
  { id: 'm2', userId: 'u2', name: 'Vet Two', email: 'vet@example.com', role: 'VETERINARIAN', status: 'ACTIVE' },
  { id: 'm3', userId: 'u3', name: 'Old Hand', email: 'old@example.com', role: 'LABOUR', status: 'SUSPENDED' },
];

function baseRoutes() {
  return {
    '/api/farm/members': () => jsonResponse(200, { members }),
  };
}

function renderPanel(canManage = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FarmProvider farmId="f1">
          <TeamPanel farmId="f1" canManage={canManage} />
        </FarmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TeamPanel (slice 11.9)', () => {
  it('renders the roster with role and status badges', async () => {
    mockFetchRoutes(baseRoutes());
    renderPanel();

    expect((await screen.findAllByText('Owner One')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('vet@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Deactivated').length).toBeGreaterThan(0); // SUSPENDED badge
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('adds a member by email (POST body) and maps USER_NOT_FOUND to the register-first message', async () => {
    const posts: unknown[] = [];
    let fail = false;
    mockFetchRoutes({
      '/api/farm/members': (init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return fail
            ? jsonResponse(404, { error: { code: 'USER_NOT_FOUND', message: 'No account' } })
            : jsonResponse(201, {
                member: { id: 'm4', userId: 'u4', name: 'New Person', email: 'new@example.com', role: 'MANAGER', status: 'ACTIVE' },
              });
        }
        return jsonResponse(200, { members });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Owner One')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Email/), 'new@example.com');
    await user.selectOptions(within(dialog).getByLabelText(/Role/), 'MANAGER');
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ email: 'new@example.com', role: 'MANAGER' });
    expect(await screen.findByText('Member added')).toBeInTheDocument();

    // unknown email → mapped, human error copy
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Email/), 'ghost@example.com');
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }));
    expect(
      await screen.findByText('No account with this email — ask them to register first'),
    ).toBeInTheDocument();
  });

  it('changes a role via the row select (PATCH /members/:userId)', async () => {
    const patches: { url: string; body: unknown }[] = [];
    mockFetchRoutes({
      ...baseRoutes(),
      '/api/farm/members/u2': (init: RequestInit | undefined, url: string) => {
        patches.push({ url, body: JSON.parse(String(init?.body)) });
        return jsonResponse(200, { member: { ...members[1]!, role: 'MANAGER' } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Owner One')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    // DataTable renders desktop + mobile variants — pick the first instance.
    await user.selectOptions(screen.getAllByLabelText('Change role for Vet Two')[0]!, 'MANAGER');
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]!.body).toEqual({ role: 'MANAGER' });
    expect(await screen.findByText('Role updated')).toBeInTheDocument();
  });

  it('deactivates behind a danger confirm and maps LAST_OWNER to a clear explanation', async () => {
    const deletes: string[] = [];
    mockFetchRoutes({
      ...baseRoutes(),
      '/api/farm/members/u1': (init?: RequestInit) => {
        deletes.push(String(init?.method));
        return jsonResponse(422, { error: { code: 'LAST_OWNER', message: 'Last owner' } });
      },
    });
    renderPanel();
    expect((await screen.findAllByText('Owner One')).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    // first Deactivate button belongs to the first ACTIVE row (Owner One)
    await user.click(screen.getAllByRole('button', { name: 'Deactivate' })[0]!);
    expect(await screen.findByText('Deactivate this member?')).toBeInTheDocument();
    expect(deletes).toHaveLength(0);

    const confirm = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryByText('Deactivate this member?'))!;
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(deletes).toEqual(['DELETE']));
    expect(
      await screen.findByText('A farm must keep at least one active owner — promote someone else first'),
    ).toBeInTheDocument();
  });

  it('hides every management affordance for non-owners (read-only roster)', async () => {
    mockFetchRoutes(baseRoutes());
    renderPanel(false);

    expect((await screen.findAllByText('Owner One')).length).toBeGreaterThan(0);
    expect(screen.getByText('You can view the roster; only the farm owner can change it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Change role/)).not.toBeInTheDocument();
    // roles render as plain badges instead of selects
    expect(screen.getAllByText('Veterinarian').length).toBeGreaterThan(0);
  });
});
