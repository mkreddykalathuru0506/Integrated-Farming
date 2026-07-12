import { Router } from 'express';
import { z } from 'zod';
import { AnimalStatus, BatchStatus, EventType } from '@prisma/client';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import {
  CreateAnimalSchema,
  CreateBatchSchema,
  CreateBreedSchema,
  CreateSpeciesSchema,
  RecordMortalitySchema,
  RecordMovementSchema,
  UpdateAnimalSchema,
  UpdateBatchSchema,
} from './schemas';
import * as species from './species.service';
import * as batches from './batch.service';
import * as animals from './animal.service';
import * as events from './events.service';
import { batchPerformance } from './performance.service';

const BatchListSchema = ListQuerySchema.extend({ status: z.nativeEnum(BatchStatus).optional() });
const AnimalListSchema = ListQuerySchema.extend({ status: z.nativeEnum(AnimalStatus).optional() });
const MortalityListSchema = ListQuerySchema.extend({
  batchId: z.string().optional(),
  animalId: z.string().optional(),
  type: z.nativeEnum(EventType).optional(),
});
const MovementListSchema = ListQuerySchema.extend({
  batchId: z.string().optional(),
  animalId: z.string().optional(),
});

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
    const p = BatchListSchema.parse(req.query);
    if (p.page) res.json(await batches.listBatchesPaged(farmScope(req).farmId, p));
    else res.json({ batches: await batches.listBatches(farmScope(req).farmId, p) });
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

// Per-batch drill-down aggregate: FCR + cost + feed/weight/mortality series + timeline.
batchRouter.get(
  '/:id/performance',
  asyncHandler(async (req, res) => {
    res.json(await batchPerformance(farmScope(req).farmId, req.params.id!));
  }),
);

/** /api/farm/animals — individual animals (member reads; OWNER/MANAGER writes). */
export const animalRouter = Router();
animalRouter.use(requireAuth, requireFarmAccess);

animalRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = AnimalListSchema.parse(req.query);
    if (p.page) res.json(await animals.listAnimalsPaged(farmScope(req).farmId, p));
    else res.json({ animals: await animals.listAnimals(farmScope(req).farmId, p) });
  }),
);

animalRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateAnimalSchema.parse(req.body);
    res.status(201).json({ animal: await animals.createAnimal(farmScope(req).farmId, req.userId!, input) });
  }),
);

animalRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ animal: await animals.getAnimal(farmScope(req).farmId, req.params.id!) });
  }),
);

animalRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = UpdateAnimalSchema.parse(req.body);
    res.json({ animal: await animals.updateAnimal(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);

/** /api/farm/mortality — member reads; record mortality/culling = OWNER/MANAGER. */
export const mortalityRouter = Router();
mortalityRouter.use(requireAuth, requireFarmAccess);
mortalityRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = MortalityListSchema.parse(req.query);
    if (p.page) res.json(await events.listMortalityPaged(farmScope(req).farmId, p));
    else res.json({ events: await events.listMortality(farmScope(req).farmId, p) });
  }),
);
mortalityRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = RecordMortalitySchema.parse(req.body);
    res.status(201).json(await events.recordMortality(farmScope(req).farmId, req.userId!, input));
  }),
);

/** /api/farm/movements — member reads; relocate an animal/batch = OWNER/MANAGER. */
export const movementRouter = Router();
movementRouter.use(requireAuth, requireFarmAccess);
movementRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = MovementListSchema.parse(req.query);
    if (p.page) res.json(await events.listMovementsPaged(farmScope(req).farmId, p));
    else res.json({ movements: await events.listMovements(farmScope(req).farmId, p) });
  }),
);
movementRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = RecordMovementSchema.parse(req.body);
    res.status(201).json({ movement: await events.recordMovement(farmScope(req).farmId, req.userId!, input) });
  }),
);
