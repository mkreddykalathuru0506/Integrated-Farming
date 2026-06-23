import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateFeedItemSchema, PurchaseSchema } from './schemas';
import * as feed from './service';

/** /api/farm/feed — feed inventory (member reads; OWNER/MANAGER/ACCOUNTANT writes). */
export const feedRouter = Router();
feedRouter.use(requireAuth, requireFarmAccess);

feedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ items: await feed.listFeedItems(farmScope(req).farmId) });
  }),
);

feedRouter.get(
  '/low-stock',
  asyncHandler(async (req, res) => {
    res.json({ items: await feed.lowStock(farmScope(req).farmId) });
  }),
);

feedRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateFeedItemSchema.parse(req.body);
    res.status(201).json({ item: await feed.createFeedItem(farmScope(req).farmId, req.userId!, input) });
  }),
);

feedRouter.post(
  '/purchase',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = PurchaseSchema.parse(req.body);
    res.status(201).json(await feed.recordPurchase(farmScope(req).farmId, req.userId!, input));
  }),
);
