import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../i18n';
import { ErrorBoundary } from './ErrorBoundary';

function Thrower(): never {
  throw new Error('boom');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('catches a render error and shows the friendly fallback with a reload button', () => {
    // React logs caught boundary errors — keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('This section failed to load. Reload the page to try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>healthy content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy content')).toBeInTheDocument();
  });

  it('resets when resetKey changes (section navigation recovers)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="b">
        <p>recovered</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('recovered')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
