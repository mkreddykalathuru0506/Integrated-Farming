import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '../i18n';
import { ToastProvider, useToast } from './Toast';

function Demo() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('saved ok')}>fire-success</button>
      <button onClick={() => toast.error('failed bad')}>fire-error</button>
      <button onClick={() => toast.warning('careful now')}>fire-warning</button>
    </div>
  );
}

function setup() {
  return render(
    <ToastProvider>
      <Demo />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('renders a success toast with the success variant styling', () => {
    setup();
    fireEvent.click(screen.getByText('fire-success'));
    const root = screen.getByText('saved ok').closest('[data-variant]');
    expect(root).toHaveAttribute('data-variant', 'success');
    expect(root?.className).toContain('border-l-success');
  });

  it('renders an error toast with the destructive edge', () => {
    setup();
    fireEvent.click(screen.getByText('fire-error'));
    const root = screen.getByText('failed bad').closest('[data-variant]');
    expect(root).toHaveAttribute('data-variant', 'error');
    expect(root?.className).toContain('border-l-destructive');
  });

  it('stacks multiple toasts', () => {
    setup();
    fireEvent.click(screen.getByText('fire-success'));
    fireEvent.click(screen.getByText('fire-warning'));
    expect(screen.getByText('saved ok')).toBeInTheDocument();
    expect(screen.getByText('careful now')).toBeInTheDocument();
  });

  it('auto-dismisses after 5 seconds', () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByText('fire-success'));
    expect(screen.getByText('saved ok')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000 + 300); // duration + exit-animation grace
    });
    expect(screen.queryByText('saved ok')).not.toBeInTheDocument();
  });
});
