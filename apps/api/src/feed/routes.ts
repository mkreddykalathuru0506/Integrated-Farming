import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ConsumeSchema, CreateFeedItemSchema, PurchaseSchema, UpdateFeedItemSchema } from './schemas';
import * as feed from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

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

feedRouter.post(
  '/consume',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = ConsumeSchema.parse(req.body);
    res.status(201).json(await feed.recordConsumption(farmScope(req).farmId, req.userId!, input));
  }),
);

feedRouter.get(
  '/fcr',
  asyncHandler(async (req, res) => {
    const batchId = q(req.query.batchId);
    if (!batchId) {
      res.status(400).json({ error: { code: 'BATCH_REQUIRED', message: 'batchId query is required' } });
      return;
    }
    res.json(await feed.batchFcr(farmScope(req).farmId, batchId));
  }),
);

// Registered after the static routes so /low-stock, /purchase, /consume, /fcr always win.
feedRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = UpdateFeedItemSchema.parse(req.body);
    res.json({ item: await feed.updateFeedItem(farmScope(req).farmId, req.userId!, req.params.id!, input) });
  }),
);
