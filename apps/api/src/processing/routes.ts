import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateProcessingSchema } from './schemas';
import * as proc from './service';

/** /api/farm/processing — slaughter/processing runs (write = OWNER/MANAGER). */
export const processingRouter = Router();
processingRouter.use(requireAuth, requireFarmAccess);

processingRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json({ runs: await proc.listProcessing(farmScope(req).farmId) })),
);

processingRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateProcessingSchema.parse(req.body);
    res.status(201).json({ run: await proc.createProcessing(farmScope(req).farmId, req.userId!, input) });
  }),
);

/** /api/farm/lots — product lots + traceability. */
export const lotRouter = Router();
lotRouter.use(requireAuth, requireFarmAccess);

lotRouter.get('/', asyncHandler(async (req, res) => res.json({ lots: await proc.listLots(farmScope(req).farmId) })));

lotRouter.get(
  '/:id/trace',
  asyncHandler(async (req, res) => res.json(await proc.traceLot(farmScope(req).farmId, req.params.id!))),
);
