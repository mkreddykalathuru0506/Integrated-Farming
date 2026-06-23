import { z } from 'zod';
import { TrackingMode, Sex, EventType } from '@prisma/client';

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

export const CreateAnimalSchema = z.object({
  speciesId: z.string().min(1),
  breedId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
  tagNumber: z.string().min(1).max(60).optional(),
  name: z.string().max(120).optional(),
  sex: z.nativeEnum(Sex).optional(),
  dob: z.string().datetime().optional(),
});

export const UpdateAnimalSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  unitId: z.string().min(1).nullable().optional(),
  tagNumber: z.string().min(1).max(60).nullable().optional(),
  sex: z.nativeEnum(Sex).optional(),
  dob: z.string().datetime().nullable().optional(),
});

const exactlyOneTarget = (d: { animalId?: string; batchId?: string }) => !!d.animalId !== !!d.batchId;

export const RecordMortalitySchema = z
  .object({
    animalId: z.string().min(1).optional(),
    batchId: z.string().min(1).optional(),
    type: z.nativeEnum(EventType),
    count: z.number().int().positive().optional(),
    cause: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .refine(exactlyOneTarget, { message: 'Provide exactly one of animalId or batchId' });

export const RecordMovementSchema = z
  .object({
    animalId: z.string().min(1).optional(),
    batchId: z.string().min(1).optional(),
    toUnitId: z.string().min(1),
    reason: z.string().max(200).optional(),
  })
  .refine(exactlyOneTarget, { message: 'Provide exactly one of animalId or batchId' });

export type CreateSpeciesInput = z.infer<typeof CreateSpeciesSchema>;
export type CreateBatchInput = z.infer<typeof CreateBatchSchema>;
export type UpdateBatchInput = z.infer<typeof UpdateBatchSchema>;
export type CreateAnimalInput = z.infer<typeof CreateAnimalSchema>;
export type UpdateAnimalInput = z.infer<typeof UpdateAnimalSchema>;
export type RecordMortalityInput = z.infer<typeof RecordMortalitySchema>;
export type RecordMovementInput = z.infer<typeof RecordMovementSchema>;
