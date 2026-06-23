import { z } from 'zod';
import { LogType } from '@prisma/client';

export const CreateLogSchema = z
  .object({
    type: z.nativeEnum(LogType),
    batchId: z.string().min(1).optional(),
    animalId: z.string().min(1).optional(),
    unitId: z.string().min(1).optional(),
    quantity: z.number().int().positive(),
    unit: z.string().min(1).max(16),
    loggedAt: z.string().datetime().optional(),
    notes: z.string().max(300).optional(),
    clientLogId: z.string().min(8).max(64).optional(),
  })
  .refine((d) => Boolean(d.batchId || d.animalId || d.unitId), {
    message: 'A batch, animal, or unit target is required',
  });

export type CreateLogInput = z.infer<typeof CreateLogSchema>;
