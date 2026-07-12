import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import '../i18n';
import { FarmProvider } from './FarmContext';
import { ToastProvider } from '../ui/Toast';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { dueKey, openRisksKey, useAckRisk } from './intelligence.hooks';
import { farmKeys } from './keys';

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <FarmProvider farmId="f1">{children}</FarmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('canonical intel cache coherence (slice 11.8a)', () => {
  it('one canonical key per endpoint (risk + due), regardless of consumer', () => {
    // The dashboard, Weather panel and bell all resolve to these two keys.
    expect(openRisksKey('f1')).toEqual(farmKeys.list('f1', 'risk', { status: 'OPEN' }));
    expect(dueKey('f1', 7)).toEqual(farmKeys.list('f1', 'due', { days: 7 }));
  });

  it('useAckRisk invalidates the shared risk + due + dashboard caches (one ack → all surfaces)', async () => {
    mockFetchRoutes({
      '/api/farm/risk/r1/ack': (init) =>
        init?.method === 'POST'
          ? jsonResponse(200, { risk: { id: 'r1', status: 'ACKNOWLEDGED' } })
          : jsonResponse(404, { error: { code: 'NOT_FOUND' } }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useAckRisk('bell.acked'), { wrapper: wrapper(client) });
    result.current.mutate('r1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The prefix-safe 'risk' key covers openRisksKey's {status:'OPEN'} variant too.
    const invalidated = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated).toContain(JSON.stringify(farmKeys.list('f1', 'risk')));
    expect(invalidated).toContain(JSON.stringify(farmKeys.list('f1', 'due')));
    expect(invalidated).toContain(JSON.stringify(farmKeys.list('f1', 'dashboard')));
  });
});
