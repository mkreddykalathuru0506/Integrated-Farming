import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { request, type RequestOptions } from '../lib/http';

export type FarmApi = {
  farmId: string;
  /**
   * Farm-scoped JSON request. No token parameter — auth is injected by the
   * authed fetch delegate (AuthContext), so token threading ends here.
   */
  fetchJson: <T>(path: string, init?: Omit<RequestOptions, 'farmId' | 'token'>) => Promise<T>;
};

const FarmCtx = createContext<FarmApi | null>(null);

/** Provides the selected farm's id + a farm-scoped fetch to all panels/hooks. */
export function FarmProvider({ farmId, children }: { farmId: string; children: ReactNode }) {
  const value = useMemo<FarmApi>(
    () => ({
      farmId,
      fetchJson: (path, init) => request(path, { farmId, ...init }),
    }),
    [farmId],
  );
  return <FarmCtx.Provider value={value}>{children}</FarmCtx.Provider>;
}

export function useFarmApi(): FarmApi {
  const ctx = useContext(FarmCtx);
  if (!ctx) throw new Error('useFarmApi must be used within FarmProvider');
  return ctx;
}
