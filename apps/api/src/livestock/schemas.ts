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

export type CreateSpeciesInput = z.infer<typeof CreateSpeciesSchema>;
