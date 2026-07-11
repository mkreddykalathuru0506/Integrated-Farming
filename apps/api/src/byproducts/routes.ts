import { Router } from 'express';
import { z } from 'zod';
import { ByproductType } from '@prisma/client';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import { CreateTransferSchema } from './schemas';
import * as byproducts from './service';

const TransferListSchema = ListQuerySchema.extend({ type: z.nativeEnum(ByproductType).optional() });

/** /api/farm/byproducts — byproduct transfers (litter→compost→nursery). Write = OWNER/MANAGER. */
export const byproductRouter = Router();
byproductRouter.use(requireAuth, requireFarmAccess);

byproductRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = TransferListSchema.parse(req.query);
    if (p.page) res.json(await byproducts.listTransfersPaged(farmScope(req).farmId, p));
    else res.json({ transfers: await byproducts.listTransfers(farmScope(req).farmId, p) });
  }),
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
