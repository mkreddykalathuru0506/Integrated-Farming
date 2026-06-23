import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateColdStorageSchema, RecordTempSchema } from './schemas';
import * as cold from './service';

/** /api/farm/coldstorage — cold-chain stores + temperature logs + out-of-range alerts. */
export const coldStorageRouter = Router();
coldStorageRouter.use(requireAuth, requireFarmAccess);

coldStorageRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json({ stores: await cold.listColdStorages(farmScope(req).farmId) })),
);

coldStorageRouter.get(
  '/alerts',
  asyncHandler(async (req, res) => res.json({ alerts: await cold.listAlerts(farmScope(req).farmId) })),
);

coldStorageRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateColdStorageSchema.parse(req.body);
    res.status(201).json({ store: await cold.createColdStorage(farmScope(req).farmId, req.userId!, input) });
  }),
);

coldStorageRouter.get(
  '/:id/temps',
  asyncHandler(async (req, res) => res.json({ temps: await cold.listTemps(farmScope(req).farmId, req.params.id!) })),
);

// Labour records temperatures on the floor.
coldStorageRouter.post(
  '/:id/temps',
  requireRole('OWNER', 'MANAGER', 'LABOUR'),
  asyncHandler(async (req, res) => {
    const input = RecordTempSchema.parse(req.body);
    res.status(201).json({ temp: await cold.recordTemp(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);
