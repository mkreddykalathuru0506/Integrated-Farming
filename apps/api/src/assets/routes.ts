import { Router } from 'express';
import { z } from 'zod';
import { AssetStatus } from '@prisma/client';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import { CreateAssetSchema, CreateScheduleSchema, RecordMaintenanceSchema } from './schemas';
import * as assets from './service';

const write = requireRole('OWNER', 'MANAGER');

const AssetListSchema = ListQuerySchema.extend({ status: z.nativeEnum(AssetStatus).optional() });

/** /api/farm/assets — asset register + maintenance schedules/records + reminders. */
export const assetRouter = Router();
assetRouter.use(requireAuth, requireFarmAccess);

assetRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = AssetListSchema.parse(req.query);
    if (p.page) res.json(await assets.listAssetsPaged(farmScope(req).farmId, p));
    else res.json({ assets: await assets.listAssets(farmScope(req).farmId, p) });
  }),
);

assetRouter.get('/reminders', asyncHandler(async (req, res) => res.json(await assets.reminders(farmScope(req).farmId))));

assetRouter.post(
  '/',
  write,
  asyncHandler(async (req, res) => {
    const input = CreateAssetSchema.parse(req.body);
    res.status(201).json({ asset: await assets.createAsset(farmScope(req).farmId, req.userId!, input) });
  }),
);

assetRouter.post(
  '/:id/schedules',
  write,
  asyncHandler(async (req, res) => {
    const input = CreateScheduleSchema.parse(req.body);
    res.status(201).json({ schedule: await assets.createSchedule(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);

assetRouter.get(
  '/:id/maintenance',
  asyncHandler(async (req, res) => res.json({ records: await assets.listMaintenance(farmScope(req).farmId, req.params.id!) })),
);

assetRouter.post(
  '/:id/maintenance',
  write,
  asyncHandler(async (req, res) => {
    const input = RecordMaintenanceSchema.parse(req.body);
    res.status(201).json({ record: await assets.recordMaintenance(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);
