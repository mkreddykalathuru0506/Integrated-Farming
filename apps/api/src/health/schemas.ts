import { z } from 'zod';
import { HealthEventType } from '@prisma/client';

const exactlyOneTarget = (d: { animalId?: string; batchId?: string }) => !!d.animalId !== !!d.batchId;
const TARGET_MSG = { message: 'Provide exactly one of animalId or batchId' };

export const CreateHealthRecordSchema = z
  .object({
    animalId: z.string().min(1).optional(),
    batchId: z.string().min(1).optional(),
    type: z.nativeEnum(HealthEventType),
    occurredAt: z.string().datetime().optional(),
    description: z.string().max(500).optional(),
    vetName: z.string().max(120).optional(),
    diagnosis: z.string().max(300).optional(),
  })
  .refine(exactlyOneTarget, TARGET_MSG);

export const RecordMedicationSchema = z
  .object({
    animalId: z.string().min(1).optional(),
    batchId: z.string().min(1).optional(),
    drugName: z.string().min(1).max(120),
    dose: z.string().max(60).optional(),
    route: z.string().max(60).optional(),
    administeredAt: z.string().datetime().optional(),
    withdrawalDays: z.number().int().nonnegative(),
  })
  .refine(exactlyOneTarget, TARGET_MSG);

export const SaleReadySchema = z
  .object({
    animalId: z.string().min(1).optional(),
    batchId: z.string().min(1).optional(),
  })
  .refine(exactlyOneTarget, TARGET_MSG);

export type CreateHealthRecordInput = z.infer<typeof CreateHealthRecordSchema>;
export type RecordMedicationInput = z.infer<typeof RecordMedicationSchema>;
export type SaleReadyInput = z.infer<typeof SaleReadySchema>;
