import { z } from 'zod';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const RecordRateSchema = z.object({
  commodity: z.string().min(1).max(80),
  market: z.string().max(80).optional(),
  pricePaise: paise,
  unit: z.string().min(1).max(20),
  observedAt: z.string().datetime().optional(),
});

export const RefreshRateSchema = z.object({
  commodity: z.string().min(1).max(80),
  market: z.string().max(80).optional(),
});

export type RecordRateInput = z.infer<typeof RecordRateSchema>;
export type RefreshRateInput = z.infer<typeof RefreshRateSchema>;
