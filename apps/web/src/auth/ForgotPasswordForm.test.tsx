import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { ForgotPasswordForm } from './ForgotPasswordForm';

function renderForm(onDone = vi.fn(), onBack = vi.fn()) {
  render(
    <ToastProvider>
      <ForgotPasswordForm onDone={onDone} onBack={onBack} />
    </ToastProvider>,
  );
  return { onDone, onBack };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('ForgotPasswordForm', () => {
  it('walks email → generic confirmation → code + new password → done + toast', async () => {
    const forgots: unknown[] = [];
    const resets: unknown[] = [];
    mockFetchRoutes({
      '/api/auth/forgot': (init) => {
        forgots.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { ok: true, retryAfterSec: 60 });
      },
      '/api/auth/reset': (init) => {
        resets.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { ok: true });
      },
    });
    const { onDone } = renderForm();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'owner@demo.farm');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));

    // Enumeration-proof confirmation — generic wording, no account existence leak.
    expect(
      await screen.findByText(/If an account exists for owner@demo.farm/),
    ).toBeInTheDocument();
    expect(forgots).toEqual([{ email: 'owner@demo.farm' }]);
    // Resend cooldown seeded from the server's retryAfterSec.
    expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();

    await user.type(screen.getByLabelText(/6-digit code/i), '123456');
    await user.type(screen.getByLabelText(/new password/i), 'NewPassw0rd!');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(resets).toEqual([
      { email: 'owner@demo.farm', code: '123456', newPassword: 'NewPassw0rd!' },
    ]);
    expect(
      await screen.findByText('Password reset — sign in with your new password'),
    ).toBeInTheDocument();
  });

  it('maps OTP_INVALID to a clear message and stays on the reset step', async () => {
    mockFetchRoutes({
      '/api/auth/forgot': () => jsonResponse(200, { ok: true, retryAfterSec: 60 }),
      '/api/auth/reset': () =>
        jsonResponse(401, { error: { code: 'OTP_INVALID', message: 'Invalid or expired code' } }),
    });
    const { onDone } = renderForm();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'owner@demo.farm');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));
    await user.type(await screen.findByLabelText(/6-digit code/i), '000000');
    await user.type(screen.getByLabelText(/new password/i), 'NewPassw0rd!');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(
      await screen.findByText('That code is incorrect or has expired — request a new one'),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
