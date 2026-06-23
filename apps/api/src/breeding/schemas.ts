import { z } from 'zod';
import { BreedingStatus } from '@prisma/client';

export const CreateBreedingSchema = z.object({
  speciesId: z.string().min(1).optional(),
  damId: z.string().min(1).optional(),
  sireId: z.string().min(1).optional(),
  method: z.string().max(80).optional(),
  breedingDate: z.string().datetime(),
  expectedDueDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const UpdateBreedingSchema = z.object({
  status: z.nativeEnum(BreedingStatus).optional(),
  offspringCount: z.number().int().nonnegative().nullable().optional(),
  expectedDueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateBreedingInput = z.infer<typeof CreateBreedingSchema>;
export type UpdateBreedingInput = z.infer<typeof UpdateBreedingSchema>;
