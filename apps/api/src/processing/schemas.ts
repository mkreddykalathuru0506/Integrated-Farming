import { z } from 'zod';

export const CreateProcessingSchema = z
  .object({
    sourceBatchId: z.string().min(1).optional(),
    sourceAnimalId: z.string().min(1).optional(),
    inputCount: z.number().int().positive().optional(),
    processedAt: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
    lots: z
      .array(
        z.object({
          productName: z.string().min(1).max(160),
          state: z.enum(['FRESH', 'FROZEN']).optional(),
          quantityKg: z.number().positive(),
          coldStorageId: z.string().min(1).optional(),
          expiryDate: z.string().datetime().optional(),
        }),
      )
      .min(1),
  })
  .refine((d) => Boolean(d.sourceBatchId) || Boolean(d.sourceAnimalId), {
    message: 'A source batch or animal is required for traceability',
    path: ['sourceBatchId'],
  })
  .refine((d) => !(d.sourceBatchId && d.sourceAnimalId), {
    message: 'Provide either a source batch or a source animal, not both',
    path: ['sourceAnimalId'],
  });

export type CreateProcessingInput = z.infer<typeof CreateProcessingSchema>;
