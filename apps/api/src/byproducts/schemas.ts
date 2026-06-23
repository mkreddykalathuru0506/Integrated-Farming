import { z } from 'zod';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const BYPRODUCT_TYPES = [
  'LITTER',
  'MANURE',
  'COMPOST',
  'SLURRY',
  'EGGSHELL',
  'SLAUGHTER_WASTE',
  'CROP_RESIDUE',
  'OTHER',
] as const;

export const CreateTransferSchema = z.object({
  byproductType: z.enum(BYPRODUCT_TYPES),
  fromUnitId: z.string().min(1).optional(),
  toUnitId: z.string().min(1).optional(),
  sourceBatchId: z.string().min(1).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(20).optional(),
  creditPaise: paise.optional(),
  transferredAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
