import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateBreedSchema, CreateSpeciesSchema } from './schemas';
import * as species from './species.service';

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
