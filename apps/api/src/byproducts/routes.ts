import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateTransferSchema } from './schemas';
import * as byproducts from './service';

/** /api/farm/byproducts — byproduct transfers (litter→compost→nursery). Write = OWNER/MANAGER. */
export const byproductRouter = Router();
byproductRouter.use(requireAuth, requireFarmAccess);

byproductRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json({ transfers: await byproducts.listTransfers(farmScope(req).farmId) })),
);

byproductRouter.get(
  '/circularity',
  asyncHandler(async (req, res) => res.json(await byproducts.circularity(farmScope(req).farmId))),
);

byproductRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateTransferSchema.parse(req.body);
    res.status(201).json({ transfer: await byproducts.createTransfer(farmScope(req).farmId, req.userId!, input) });
  }),
);
