import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { getMyFarms, listFarmMembers } from './service';

/** User-level: /api/me/* (auth only, not farm-scoped). */
export const meRouter = Router();
meRouter.get(
  '/farms',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ farms: await getMyFarms(req.userId!) });
  }),
);

/** Tenant-scoped: /api/farm/* (auth + X-Farm-Id membership + role). */
export const farmRouter = Router();
farmRouter.get(
  '/members',
  requireAuth,
  requireFarmAccess,
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { farmId } = farmScope(req);
    res.json({ members: await listFarmMembers(farmId) });
  }),
);
