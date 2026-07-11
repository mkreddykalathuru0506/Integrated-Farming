import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, render, screen, waitFor } from '@testing-library/react';

// jsdom + Radix dialogs are slow when the full suite runs in parallel — the 1 s
// default async timeout flakes under load.
configure({ asyncUtilTimeout: 5000 });
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { CreateFarm } from './CreateFarm';

function renderPanel(onCreated: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateFarm onCreated={onCreated} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('CreateFarm (first-run experience)', () => {
  it('validates the required name before posting', async () => {
    const posts: unknown[] = [];
    mockFetchRoutes({
      '/api/farms': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { farm: { id: 'f1' } });
      },
    });
    renderPanel(() => undefined);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create farm' }));
    expect(await screen.findByText('Enter a farm name')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('creates the farm and calls onCreated', async () => {
    const posts: unknown[] = [];
    const onCreated = vi.fn();
    mockFetchRoutes({
      '/api/farms': (init) => {
        posts.push(JSON.parse(String(init?.body)));
        return jsonResponse(201, { farm: { id: 'f1' } });
      },
    });
    renderPanel(onCreated);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Farm name/), 'Green Acres');
    await user.type(screen.getByLabelText(/State/), 'Telangana');
    await user.click(screen.getByRole('button', { name: 'Create farm' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ name: 'Green Acres', state: 'Telangana' });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Farm created')).toBeInTheDocument();
  });
});
