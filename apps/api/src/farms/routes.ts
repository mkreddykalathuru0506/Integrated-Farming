import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import {
  CreateFarmSchema,
  CreateUnitSchema,
  UpdateFarmSchema,
  UpdateSettingsSchema,
  UpdateUnitSchema,
} from './schemas';
import * as farms from './service';

/** /api/farms — create a farm (caller becomes OWNER). Not farm-scoped. */
export const farmsRouter = Router();
farmsRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = CreateFarmSchema.parse(req.body);
    res.status(201).json({ farm: await farms.createFarm(req.userId!, input) });
  }),
);

/** /api/farm/* — current-farm resources. All require membership via X-Farm-Id. */
export const farmCrudRouter = Router();
farmCrudRouter.use(requireAuth, requireFarmAccess);

farmCrudRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ farm: await farms.getFarm(farmScope(req).farmId) });
  }),
);

farmCrudRouter.patch(
  '/',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const input = UpdateFarmSchema.parse(req.body);
    res.json({ farm: await farms.updateFarm(farmScope(req).farmId, req.userId!, input) });
  }),
);

farmCrudRouter.get(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json({ settings: await farms.getSettings(farmScope(req).farmId) });
  }),
);

farmCrudRouter.put(
  '/settings',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const input = UpdateSettingsSchema.parse(req.body);
    res.json({ settings: await farms.updateSettings(farmScope(req).farmId, input) });
  }),
);

farmCrudRouter.get(
  '/units',
  asyncHandler(async (req, res) => {
    res.json({ units: await farms.listUnits(farmScope(req).farmId) });
  }),
);

farmCrudRouter.post(
  '/units',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateUnitSchema.parse(req.body);
    res.status(201).json({ unit: await farms.createUnit(farmScope(req).farmId, req.userId!, input) });
  }),
);

farmCrudRouter.patch(
  '/units/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = UpdateUnitSchema.parse(req.body);
    const unit = await farms.updateUnit(farmScope(req).farmId, req.params.id!, req.userId!, input);
    res.json({ unit });
  }),
);

farmCrudRouter.delete(
  '/units/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    await farms.softDeleteUnit(farmScope(req).farmId, req.params.id!, req.userId!);
    res.json({ ok: true });
  }),
);
