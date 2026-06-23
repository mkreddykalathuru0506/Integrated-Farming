import { z } from 'zod';
import { TrackingMode } from '@prisma/client';

export const CreateSpeciesSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/, 'code must be alphanumeric/underscore'),
  name: z.string().min(1).max(80),
  trackingMode: z.nativeEnum(TrackingMode),
});

export const CreateBreedSchema = z.object({
  name: z.string().min(1).max(80),
});

export const CreateBatchSchema = z.object({
  speciesId: z.string().min(1),
  breedId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
  code: z.string().min(1).max(60),
  name: z.string().max(120).optional(),
  initialCount: z.number().int().positive(),
  source: z.string().max(120).optional(),
  acquiredAt: z.string().datetime().optional(),
});

export const UpdateBatchSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  unitId: z.string().min(1).nullable().optional(),
  source: z.string().max(120).nullable().optional(),
});

export type CreateSpeciesInput = z.infer<typeof CreateSpeciesSchema>;
export type CreateBatchInput = z.infer<typeof CreateBatchSchema>;
export type UpdateBatchInput = z.infer<typeof UpdateBatchSchema>;
