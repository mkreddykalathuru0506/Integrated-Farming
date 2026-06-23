import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { AddIncubationLogSchema, CreateHatcherySchema, UpdateHatcherySchema } from './schemas';
import * as hatchery from './service';

/** /api/farm/hatchery — incubation batches + logs (member reads; OWNER/MANAGER writes). */
export const hatcheryRouter = Router();
hatcheryRouter.use(requireAuth, requireFarmAccess);

hatcheryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ batches: await hatchery.listHatchery(farmScope(req).farmId) });
  }),
);

hatcheryRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateHatcherySchema.parse(req.body);
    res.status(201).json({ batch: await hatchery.createHatchery(farmScope(req).farmId, req.userId!, input) });
  }),
);

hatcheryRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ batch: await hatchery.getHatchery(farmScope(req).farmId, req.params.id!) });
  }),
);

hatcheryRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = UpdateHatcherySchema.parse(req.body);
    res.json({ batch: await hatchery.updateHatchery(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);

hatcheryRouter.post(
  '/:id/logs',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = AddIncubationLogSchema.parse(req.body);
    res.status(201).json({ log: await hatchery.addIncubationLog(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);
