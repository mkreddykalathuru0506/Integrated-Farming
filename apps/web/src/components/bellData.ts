import { useDue, useOpenRisks as useOpenRisksBase } from '../api/intelligence.hooks';

/**
 * The bell's two polled queries. They reuse the CANONICAL intel cache entries
 * (intelligence.hooks.ts) — same keys the dashboard + Weather panel use — so
 * acking a risk anywhere reconciles every surface (no more 'bell' fragment).
 * Polling is a per-observer option layered on the shared cache entry.
 */
const POLL = { refetchInterval: 60_000, staleTime: 55_000 } as const;

export function useOpenRisks() {
  return useOpenRisksBase(POLL);
}

export function useDueRollup() {
  return useDue(7, POLL);
}
