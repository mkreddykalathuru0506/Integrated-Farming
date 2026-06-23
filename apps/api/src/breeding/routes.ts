import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateBreedingSchema, UpdateBreedingSchema } from './schemas';
import * as breeding from './service';

/** /api/farm/breeding — breeding records + lineage (member reads; OWNER/MANAGER/VET writes). */
export const breedingRouter = Router();
breedingRouter.use(requireAuth, requireFarmAccess);

breedingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ records: await breeding.listBreeding(farmScope(req).farmId) });
  }),
);

breedingRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'VETERINARIAN'),
  asyncHandler(async (req, res) => {
    const input = CreateBreedingSchema.parse(req.body);
    res.status(201).json({ record: await breeding.createBreeding(farmScope(req).farmId, req.userId!, input) });
  }),
);

breedingRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER', 'VETERINARIAN'),
  asyncHandler(async (req, res) => {
    const input = UpdateBreedingSchema.parse(req.body);
    res.json({ record: await breeding.updateBreeding(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);
