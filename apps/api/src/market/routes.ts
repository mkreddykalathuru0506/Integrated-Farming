import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { RecordRateSchema, RefreshRateSchema } from './schemas';
import * as market from './service';

const write = requireRole('OWNER', 'MANAGER', 'ACCOUNTANT');

/** /api/farm/market — market rates (manual entry primary + provider refresh) + price-drop flags. */
export const marketRouter = Router();
marketRouter.use(requireAuth, requireFarmAccess);

marketRouter.get('/', asyncHandler(async (req, res) => res.json({ rates: await market.listRates(farmScope(req).farmId) })));

marketRouter.post(
  '/',
  write,
  asyncHandler(async (req, res) => {
    const input = RecordRateSchema.parse(req.body);
    res.status(201).json(await market.recordRate(farmScope(req).farmId, req.userId!, input));
  }),
);

marketRouter.post(
  '/refresh',
  write,
  asyncHandler(async (req, res) => {
    const input = RefreshRateSchema.parse(req.body);
    res.status(201).json(await market.refreshRate(farmScope(req).farmId, req.userId!, input));
  }),
);
