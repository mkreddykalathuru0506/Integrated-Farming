import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import { RecordRateSchema, RefreshRateSchema } from './schemas';
import * as market from './service';

const write = requireRole('OWNER', 'MANAGER', 'ACCOUNTANT');

const HistoryQuerySchema = ListQuerySchema.extend({ commodity: z.string().trim().optional() });

/** /api/farm/market — market rates (manual entry primary + provider refresh) + price-drop flags. */
export const marketRouter = Router();
marketRouter.use(requireAuth, requireFarmAccess);

marketRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = ListQuerySchema.parse(req.query);
    if (p.page) res.json(await market.listRatesPaged(farmScope(req).farmId, p));
    else res.json({ rates: await market.listRates(farmScope(req).farmId, p) });
  }),
);

// Full observation history for one commodity (chart-ready, asc; default last 90 days).
marketRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const p = HistoryQuerySchema.parse(req.query);
    if (!p.commodity) throw new AppError(400, 'COMMODITY_REQUIRED', 'commodity query is required');
    res.json(await market.rateHistory(farmScope(req).farmId, p.commodity, p));
  }),
);

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
