import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { changeLanguage } from '../i18n';
import { Landing } from './Landing';

// jsdom has no matchMedia (ThemeToggle + the reveal hook consult it).
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

afterAll(async () => {
  vi.unstubAllGlobals();
  await changeLanguage('en');
});

describe('Landing', () => {
  it('renders the hero, all four feature sections, the stats band and the footer', () => {
    render(<Landing onSignIn={vi.fn()} onGetStarted={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/your whole farm/i);
    expect(screen.getByRole('heading', { name: /everything a mixed farm needs/i })).toBeInTheDocument();

    // one heading per feature section
    expect(screen.getByRole('heading', { name: /log it in the shed/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /every rupee accounted/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /farm to fork/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /know before it hurts/i })).toBeInTheDocument();

    // credibility band is factual and present
    expect(screen.getByText(/money stored as integer paise/i)).toBeInTheDocument();

    // landmarks
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('wires the CTAs: Get started → register intent, Sign in (topbar + hero) → login intent', async () => {
    const onSignIn = vi.fn();
    const onGetStarted = vi.fn();
    render(<Landing onSignIn={onSignIn} onGetStarted={onGetStarted} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('landing-get-started'));
    expect(onGetStarted).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('landing-signin'));
    expect(onSignIn).toHaveBeenCalledTimes(1);

    // hero secondary CTA also opens sign-in
    const signInButtons = screen.getAllByRole('button', { name: /^sign in$/i });
    expect(signInButtons.length).toBeGreaterThanOrEqual(2);
    await user.click(signInButtons[signInButtons.length - 1]!);
    expect(onSignIn).toHaveBeenCalledTimes(2);
  });

  it('resolves every visible string in Hindi too (landing namespace parity)', async () => {
    await changeLanguage('hi');
    render(<Landing onSignIn={vi.fn()} onGetStarted={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('पूरा फ़ार्म');
    expect(screen.getByRole('button', { name: 'शुरू करें' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /नुक़सान से पहले जानिए/ })).toBeInTheDocument();
    await changeLanguage('en');
  });
});
