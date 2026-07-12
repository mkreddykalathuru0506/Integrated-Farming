import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { LandingGate, type AuthIntent } from './LandingGate';

beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

/** Stub auth surface: shows which view was requested + a working back control. */
function renderAuthStub(initialView: AuthIntent, onBack?: () => void) {
  return (
    <div>
      <p>auth-view:{initialView}</p>
      {onBack && (
        <button type="button" onClick={onBack}>
          back-to-landing
        </button>
      )}
    </div>
  );
}

describe('LandingGate', () => {
  it('shows the landing at `/`, switches to the login view on Sign in, and returns via back', async () => {
    render(<LandingGate renderAuth={renderAuthStub} />);
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/your whole farm/i);

    await user.click(screen.getByTestId('landing-signin'));
    expect(screen.getByText('auth-view:login')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'back-to-landing' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/your whole farm/i);
  });

  it('switches to the register view on Get started', async () => {
    render(<LandingGate renderAuth={renderAuthStub} />);
    await userEvent.setup().click(screen.getByTestId('landing-get-started'));
    expect(screen.getByText('auth-view:register')).toBeInTheDocument();
  });

  it('deep links skip the landing and go straight to the auth card without a back control', () => {
    window.history.replaceState(null, '', '/finance');
    render(<LandingGate renderAuth={renderAuthStub} />);
    expect(screen.getByText('auth-view:login')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'back-to-landing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
