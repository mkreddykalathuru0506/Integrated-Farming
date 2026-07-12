/**
 * Query-key factory — every TanStack Query key in the app comes from here so
 * invalidation is prefix-safe and farm-scoped:
 *   farmKeys.all(farmId)                → invalidate everything for a farm
 *   farmKeys.list(farmId, 'units')      → also matches every params variant
 *   farmKeys.detail(farmId, 'units', i) → one record
 */
export const farmKeys = {
  all: (farmId: string) => ['farm', farmId] as const,
  list: (farmId: string, domain: string, params?: Record<string, unknown>) =>
    params === undefined
      ? ([...farmKeys.all(farmId), domain, 'list'] as const)
      : ([...farmKeys.all(farmId), domain, 'list', params] as const),
  detail: (farmId: string, domain: string, id: string) =>
    [...farmKeys.all(farmId), domain, 'detail', id] as const,
};
