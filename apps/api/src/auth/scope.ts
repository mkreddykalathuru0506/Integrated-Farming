import type { Request } from 'express';
import { AppError } from '../errors';

/**
 * Returns the tenant filter `{ farmId }` for the current request.
 * Throws if used on a route that didn't pass through requireFarmAccess —
 * a guardrail against accidentally running an unscoped query.
 */
export function farmScope(req: Request): { farmId: string } {
  if (!req.farmId) {
    throw new AppError(500, 'NO_FARM_SCOPE', 'farmScope() used without requireFarmAccess');
  }
  return { farmId: req.farmId };
}
