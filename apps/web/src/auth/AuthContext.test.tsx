import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';

const RT_KEY = 'ifm.auth.rt';
const user = { id: 'u1', email: 'owner@demo.farm', name: 'Owner', locale: 'en' };

let auth: ReturnType<typeof useAuth> | null = null;

function Capture() {
  auth = useAuth();
  return (
    <div>
      <span data-testid="user">{auth.user?.email ?? 'none'}</span>
      <span data-testid="restoring">{String(auth.restoring)}</span>
    </div>
  );
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Capture />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  auth = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthContext boot restore', () => {
  it('restores the session from a stored refresh token and persists the rotation', async () => {
    localStorage.setItem(RT_KEY, 'rt-1');
    const refreshBodies: unknown[] = [];
    const fetchSpy = mockFetchRoutes({
      '/api/auth/refresh': (init) => {
        refreshBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse(200, { accessToken: 'at-2', refreshToken: 'rt-2', user });
      },
    });

    renderAuth();
    expect(screen.getByTestId('restoring')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner@demo.farm'));
    expect(screen.getByTestId('restoring')).toHaveTextContent('false');
    expect(refreshBodies).toEqual([{ refreshToken: 'rt-1' }]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(RT_KEY)).toBe('rt-2'); // rotation persisted
    expect(auth?.accessToken).toBe('at-2');
  });

  it('lands on a clean logged-out state when the boot refresh fails', async () => {
    localStorage.setItem(RT_KEY, 'rt-stale');
    mockFetchRoutes({
      '/api/auth/refresh': () =>
        jsonResponse(401, { error: { code: 'INVALID_REFRESH', message: 'revoked' } }),
    });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('restoring')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(auth?.accessToken).toBeNull();
    expect(localStorage.getItem(RT_KEY)).toBeNull(); // storage cleared
  });

  it('skips the network entirely when no refresh token is stored', async () => {
    const fetchSpy = mockFetchRoutes({});
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('restoring')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('authedFetch 401 replay', () => {
  it('does ONE single-flight refresh for concurrent 401s and replays each request once', async () => {
    localStorage.setItem(RT_KEY, 'rt-1');
    let refreshCalls = 0;
    let unitCalls = 0;
    mockFetchRoutes({
      '/api/auth/refresh': () => {
        refreshCalls += 1;
        return jsonResponse(200, {
          accessToken: `at-${refreshCalls}`,
          refreshToken: `rt-${refreshCalls + 1}`,
          user,
        });
      },
      '/api/farm/units': (init) => {
        unitCalls += 1;
        const authz = new Headers(init?.headers).get('Authorization');
        // Only the token minted by the SECOND refresh is accepted, so the
        // boot token (at-1) 401s and forces the refresh-and-replay path.
        if (authz !== 'Bearer at-2') {
          return jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } });
        }
        return jsonResponse(200, { units: [] });
      },
    });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner@demo.farm'));
    expect(refreshCalls).toBe(1); // boot restore only

    let statuses: number[] = [];
    await act(async () => {
      const results = await Promise.all([
        auth!.authedFetch('http://localhost:4000/api/farm/units'),
        auth!.authedFetch('http://localhost:4000/api/farm/units'),
      ]);
      statuses = results.map((r) => r.status);
    });

    expect(statuses).toEqual([200, 200]);
    expect(refreshCalls).toBe(2); // one shared refresh for both 401s
    expect(unitCalls).toBe(4); // 2 initial 401s + 2 replays
    expect(localStorage.getItem(RT_KEY)).toBe('rt-3');
  });

  it('logs out globally when the replay refresh fails', async () => {
    localStorage.setItem(RT_KEY, 'rt-1');
    let refreshCalls = 0;
    mockFetchRoutes({
      '/api/auth/refresh': () => {
        refreshCalls += 1;
        if (refreshCalls === 1) {
          return jsonResponse(200, { accessToken: 'at-1', refreshToken: 'rt-2', user });
        }
        return jsonResponse(401, { error: { code: 'INVALID_REFRESH', message: 'revoked' } });
      },
      '/api/farm/units': () =>
        jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } }),
    });

    renderAuth();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('owner@demo.farm'));

    let status = 0;
    await act(async () => {
      const res = await auth!.authedFetch('http://localhost:4000/api/farm/units');
      status = res.status;
    });

    expect(status).toBe(401); // original response surfaces
    expect(screen.getByTestId('user')).toHaveTextContent('none'); // global logout
    expect(localStorage.getItem(RT_KEY)).toBeNull();
  });
});
