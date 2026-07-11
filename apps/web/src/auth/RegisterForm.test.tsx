import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { AuthProvider } from './AuthContext';
import { RegisterForm } from './RegisterForm';

const me = { id: 'u1', email: 'new@farm.in', name: 'New Farmer', locale: 'en' };

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RegisterForm onLogin={() => {}} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('RegisterForm', () => {
  it('registers and auto-signs-in with the same credentials', async () => {
    const registers: unknown[] = [];
    const logins: unknown[] = [];
    mockFetchRoutes({
      '/api/auth/register': (init) => {
        registers.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { user: me });
      },
      '/api/auth/login': (init) => {
        logins.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, {
          accessToken: 'at-1',
          refreshToken: 'rt-1',
          sessionId: 's1',
          user: me,
        });
      },
    });
    renderForm();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), 'New Farmer');
    await user.type(screen.getByLabelText(/^email/i), 'new@farm.in');
    await user.type(screen.getByLabelText(/^password/i), 'Sunrise@2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(logins).toHaveLength(1));
    // Phone left blank → omitted from the payload entirely.
    expect(registers).toEqual([
      { email: 'new@farm.in', name: 'New Farmer', password: 'Sunrise@2026' },
    ]);
    expect(logins).toEqual([{ email: 'new@farm.in', password: 'Sunrise@2026' }]);
    // Auto-login persisted the session (user lands in the app via Root).
    await waitFor(() => expect(localStorage.getItem('ifm.auth.rt')).toBe('rt-1'));
  });

  it('maps EMAIL_TAKEN to a clear message', async () => {
    mockFetchRoutes({
      '/api/auth/register': () =>
        jsonResponse(409, { error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } }),
    });
    renderForm();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), 'New Farmer');
    await user.type(screen.getByLabelText(/^email/i), 'new@farm.in');
    await user.type(screen.getByLabelText(/^password/i), 'Sunrise@2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('ifm.auth.rt')).toBeNull();
  });

  it('blocks a short password client-side (no network call)', async () => {
    const fetchSpy = mockFetchRoutes({});
    renderForm();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), 'New Farmer');
    await user.type(screen.getByLabelText(/^email/i), 'new@farm.in');
    await user.type(screen.getByLabelText(/^password/i), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Password must be at least 8 characters'),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
