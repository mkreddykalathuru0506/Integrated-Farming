import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { ApiError } from './http';
import { useApiMutation, type ApiMutationOptions } from './useApiMutation';

type Opts = Omit<ApiMutationOptions<unknown, void>, 'mutationFn'>;

function Harness({ fn, opts }: { fn: () => Promise<unknown>; opts?: Opts }) {
  const mutation = useApiMutation<unknown, void>({ mutationFn: fn, ...opts });
  return <button onClick={() => mutation.mutate()}>go</button>;
}

function renderHarness(fn: () => Promise<unknown>, opts?: Opts) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Harness fn={fn} opts={opts} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('useApiMutation', () => {
  it('on success: toasts the successKey and invalidates each given query key', async () => {
    const key = ['farm', 'f1', 'units', 'list'] as const;
    const queryClient = renderHarness(() => Promise.resolve({ ok: true }), {
      successKey: 'units.added',
      invalidate: [key],
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fireEvent.click(screen.getByText('go'));

    await waitFor(() => expect(screen.getByText('Unit added')).toBeInTheDocument());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
  });

  it('on error: errorKeyByCode mapping wins', async () => {
    renderHarness(() => Promise.reject(new ApiError(409, 'UNIT_NAME_TAKEN', 'conflict')), {
      errorKeyByCode: { UNIT_NAME_TAKEN: 'units.duplicate' },
    });
    fireEvent.click(screen.getByText('go'));
    await waitFor(() =>
      expect(screen.getByText('A unit with this name already exists')).toBeInTheDocument(),
    );
  });

  it('on error: falls back to errors.<code> when that key exists', async () => {
    renderHarness(() => Promise.reject(new ApiError(404, 'NOT_FOUND', 'nope')));
    fireEvent.click(screen.getByText('go'));
    await waitFor(() =>
      expect(screen.getByText('Not found — it may have been removed')).toBeInTheDocument(),
    );
  });

  it('on error: unknown codes and non-ApiErrors fall back to errors.generic', async () => {
    renderHarness(() => Promise.reject(new Error('boom')));
    fireEvent.click(screen.getByText('go'));
    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument(),
    );
  });
});
