import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes, type RouteHandler } from '../test/mockFetch';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { AccountDialog } from './AccountDialog';

const me = { id: 'u1', email: 'owner@demo.farm', name: 'Owner', locale: 'en' };

const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ANDROID_FIREFOX_UA = 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0';

const sessionRows = () => [
  {
    id: 's1',
    createdAt: '2026-07-10T10:00:00.000Z',
    lastUsedAt: '2026-07-11T05:00:00.000Z',
    ip: '1.2.3.4',
    userAgent: WINDOWS_CHROME_UA,
  },
  {
    id: 's2',
    createdAt: '2026-07-09T10:00:00.000Z',
    lastUsedAt: null,
    ip: '5.6.7.8',
    userAgent: ANDROID_FIREFOX_UA,
  },
];

/** The dialog is only reachable from the authed Topbar, so gate on the restored user. */
function Harness() {
  const { user } = useAuth();
  if (!user) return <p>restoring</p>;
  return <AccountDialog open onOpenChange={() => {}} />;
}

function renderDialog(routes: Record<string, RouteHandler>) {
  // Boot the AuthProvider from a persisted session so sessionId 's1' = this device.
  localStorage.setItem('ifm.auth.rt', 'rt-0');
  const spy = mockFetchRoutes({
    '/api/auth/refresh': () =>
      jsonResponse(200, { accessToken: 'at-1', refreshToken: 'rt-1', sessionId: 's1', user: me }),
    ...routes,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return spy;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('AccountDialog', () => {
  it('PATCHes only the dirty profile fields and toasts success', async () => {
    const patches: unknown[] = [];
    renderDialog({
      '/api/me': (init) => {
        patches.push({ method: init?.method, body: JSON.parse(String(init?.body)) });
        return jsonResponse(200, { user: { ...me, name: 'Owner Two' } });
      },
    });

    const user = userEvent.setup();
    const nameInput = await screen.findByLabelText(/full name/i);
    expect(nameInput).toHaveValue('Owner');

    await user.clear(nameInput);
    await user.type(nameInput, 'Owner Two');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    // Untouched phone/locale are NOT sent — blank phone must not clobber the stored one.
    expect(patches[0]).toEqual({ method: 'PATCH', body: { name: 'Owner Two' } });
    expect(await screen.findByText('Profile updated')).toBeInTheDocument();
  });

  it('lists sessions with device parsing + "this device" badge and revokes one after confirm', async () => {
    const deletes: string[] = [];
    let rows = sessionRows();
    renderDialog({
      '/api/me/sessions': () => jsonResponse(200, { sessions: [...rows] }),
      '/api/me/sessions/s2': (init) => {
        if (init?.method === 'DELETE') {
          deletes.push('s2');
          rows = rows.filter((r) => r.id !== 's2');
          return jsonResponse(200, { ok: true });
        }
        return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
      },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Devices' }));

    // jsdom renders BOTH DataTable variants (desktop table + mobile cards),
    // so scope the row assertions to the desktop <table>.
    const table = await screen.findByRole('table');
    // Light UA parsing: browser + OS words.
    expect(within(table).getByText('Chrome · Windows')).toBeInTheDocument();
    expect(within(table).getByText('Firefox · Android')).toBeInTheDocument();
    // The row matching the sessionId from the login/refresh response is "this device"…
    expect(within(table).getByText('This device')).toBeInTheDocument();
    // …and only the OTHER row offers a revoke action.
    expect(within(table).getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);

    await user.click(within(table).getByRole('button', { name: 'Sign out' }));
    const dialogs = await screen.findAllByRole('dialog');
    const confirm = dialogs.find((d) => within(d).queryByText('Sign out this device?'));
    expect(confirm).toBeTruthy();
    expect(deletes).toHaveLength(0); // nothing revoked before confirmation

    await user.click(within(confirm!).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(deletes).toEqual(['s2']));
    expect(await screen.findByText('Device signed out')).toBeInTheDocument();
  });

  it('signs out all other devices through the AuthContext (refresh token stays private)', async () => {
    const revokeBodies: unknown[] = [];
    renderDialog({
      '/api/me/sessions': () => jsonResponse(200, { sessions: sessionRows() }),
      '/api/me/sessions/revoke-others': (init) => {
        revokeBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { revoked: 1 });
      },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Devices' }));
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Sign out all other devices' }));
    const dialogs = await screen.findAllByRole('dialog');
    const confirm = dialogs.find((d) => within(d).queryByText('Sign out every other device?'));
    await user.click(within(confirm!).getByRole('button', { name: 'Sign out all other devices' }));

    // The presenting refresh token (rotated at boot → rt-1) identifies this session.
    await waitFor(() => expect(revokeBodies).toEqual([{ refreshToken: 'rt-1' }]));
    expect(await screen.findByText('Other sessions signed out')).toBeInTheDocument();
  });

  it('validates the change-password form client-side before any network call', async () => {
    let changeCalls = 0;
    renderDialog({
      '/api/auth/change-password': () => {
        changeCalls += 1;
        return jsonResponse(200, { ok: true });
      },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Security' }));
    await user.type(screen.getByLabelText(/current password/i), 'OldPassw0rd!');
    await user.type(screen.getByLabelText(/new password/i), 'short');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('Password must be at least 8 characters'),
    ).toBeInTheDocument();
    expect(changeCalls).toBe(0);
  });

  it('changes the password with the presenting refresh token and toasts the revocation note', async () => {
    const changeBodies: unknown[] = [];
    renderDialog({
      '/api/auth/change-password': (init) => {
        changeBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { ok: true });
      },
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Security' }));
    await user.type(screen.getByLabelText(/current password/i), 'OldPassw0rd!');
    await user.type(screen.getByLabelText(/new password/i), 'NewPassw0rd!');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(changeBodies).toEqual([
        { currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!', refreshToken: 'rt-1' },
      ]),
    );
    expect(
      await screen.findByText('Password changed — other sessions signed out'),
    ).toBeInTheDocument();
  });
});
