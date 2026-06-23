import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import {
  CreateBatchSchema,
  CreateBreedSchema,
  CreateSpeciesSchema,
  UpdateBatchSchema,
} from './schemas';
import * as species from './species.service';
import * as batches from './batch.service';

/** /api/farm/species — livestock reference (member reads; OWNER/MANAGER writes). */
export const speciesRouter = Router();
speciesRouter.use(requireAuth, requireFarmAccess);

speciesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ species: await species.listSpecies(farmScope(req).farmId) });
  }),
);

speciesRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateSpeciesSchema.parse(req.body);
    res.status(201).json({ species: await species.createSpecies(farmScope(req).farmId, req.userId!, input) });
  }),
);

speciesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ species: await species.getSpecies(farmScope(req).farmId, req.params.id!) });
  }),
);

speciesRouter.post(
  '/:id/breeds',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { name } = CreateBreedSchema.parse(req.body);
    res.status(201).json({ breed: await species.createBreed(farmScope(req).farmId, req.params.id!, name) });
  }),
);

/** /api/farm/batches — flock/batch records (member reads; OWNER/MANAGER writes). */
export const batchRouter = Router();
batchRouter.use(requireAuth, requireFarmAccess);

batchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ batches: await batches.listBatches(farmScope(req).farmId) });
  }),
);

batchRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateBatchSchema.parse(req.body);
    res.status(201).json({ batch: await batches.createBatch(farmScope(req).farmId, req.userId!, input) });
  }),
);

batchRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ batch: await batches.getBatch(farmScope(req).farmId, req.params.id!) });
  }),
);

batchRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = UpdateBatchSchema.parse(req.body);
    res.json({ batch: await batches.updateBatch(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);

batchRouter.post(
  '/:id/advance',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.json({ batch: await batches.advanceStage(farmScope(req).farmId, req.params.id!, req.userId!) });
  }),
);

batchRouter.post(
  '/:id/close',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.json({ batch: await batches.closeBatch(farmScope(req).farmId, req.params.id!, req.userId!) });
  }),
);
