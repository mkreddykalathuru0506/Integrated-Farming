import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginForm } from '../components/LoginForm';

const me = { id: 'u1', email: 'owner@demo.farm', name: 'Owner', locale: 'en' };

function Capture() {
  const { user, sessionId } = useAuth();
  return (
    <div>
      <span data-testid="user">{user?.email ?? 'none'}</span>
      <span data-testid="sid">{sessionId ?? 'none'}</span>
    </div>
  );
}

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <LoginForm onRegister={() => {}} onForgot={() => {}} />
          <Capture />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('OTP login flow', () => {
  it('requests a LOGIN code then verifies it and stores the session', async () => {
    const requests: unknown[] = [];
    const verifies: unknown[] = [];
    mockFetchRoutes({
      '/api/auth/otp/request': (init) => {
        requests.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { ok: true, retryAfterSec: 60 });
      },
      '/api/auth/otp/verify': (init) => {
        verifies.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, {
          accessToken: 'at-1',
          refreshToken: 'rt-1',
          sessionId: 's1',
          user: me,
        });
      },
    });
    renderLogin();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign in with a code instead' }));
    await user.type(screen.getByLabelText(/email/i), 'owner@demo.farm');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
    expect(requests).toEqual([{ email: 'owner@demo.farm', purpose: 'LOGIN' }]);
    // Resend cooldown starts at the server-provided retryAfterSec.
    expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled();

    await user.type(screen.getByLabelText(/6-digit code/i), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner@demo.farm'));
    expect(verifies).toEqual([{ email: 'owner@demo.farm', purpose: 'LOGIN', code: '654321' }]);
    // Session persisted + sessionId captured for the devices list.
    expect(localStorage.getItem('ifm.auth.rt')).toBe('rt-1');
    expect(screen.getByTestId('sid')).toHaveTextContent('s1');
  });

  it('re-enables resend after the countdown elapses and sends a fresh code', async () => {
    let requestCount = 0;
    mockFetchRoutes({
      '/api/auth/otp/request': () => {
        requestCount += 1;
        return jsonResponse(200, { ok: true, retryAfterSec: 1 });
      },
    });
    renderLogin();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign in with a code instead' }));
    await user.type(screen.getByLabelText(/email/i), 'owner@demo.farm');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));

    // Disabled while the cooldown runs…
    expect(await screen.findByRole('button', { name: 'Resend in 1s' })).toBeDisabled();
    // …then usable again once it hits zero.
    const resend = await screen.findByRole(
      'button',
      { name: 'Resend code' },
      { timeout: 4000 },
    );
    expect(resend).toBeEnabled();
    await user.click(resend);
    await waitFor(() => expect(requestCount).toBe(2));
  });

  it('maps OTP_INVALID from verify to a clear message', async () => {
    mockFetchRoutes({
      '/api/auth/otp/request': () => jsonResponse(200, { ok: true, retryAfterSec: 60 }),
      '/api/auth/otp/verify': () =>
        jsonResponse(401, { error: { code: 'OTP_INVALID', message: 'Invalid or expired code' } }),
    });
    renderLogin();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign in with a code instead' }));
    await user.type(screen.getByLabelText(/email/i), 'owner@demo.farm');
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    await user.type(await screen.findByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));

    expect(
      await screen.findByText('That code is incorrect or has expired — request a new one'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});
