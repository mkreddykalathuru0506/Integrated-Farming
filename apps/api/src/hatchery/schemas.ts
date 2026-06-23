import { z } from 'zod';
import { IncubationEventType, HatchStatus } from '@prisma/client';

export const CreateHatcherySchema = z.object({
  speciesId: z.string().min(1),
  breedId: z.string().min(1).optional(),
  code: z.string().min(1).max(60),
  setDate: z.string().datetime(),
  eggCount: z.number().int().positive(),
  incubationDays: z.number().int().positive().optional(),
});

export const AddIncubationLogSchema = z.object({
  event: z.nativeEnum(IncubationEventType),
  temperatureC: z.number().optional(),
  humidityPct: z.number().optional(),
  notes: z.string().max(300).optional(),
});

export const UpdateHatcherySchema = z.object({
  status: z.nativeEnum(HatchStatus).optional(),
  fertileCount: z.number().int().nonnegative().nullable().optional(),
  hatchedCount: z.number().int().nonnegative().nullable().optional(),
});

export type CreateHatcheryInput = z.infer<typeof CreateHatcherySchema>;
export type AddIncubationLogInput = z.infer<typeof AddIncubationLogSchema>;
export type UpdateHatcheryInput = z.infer<typeof UpdateHatcherySchema>;
