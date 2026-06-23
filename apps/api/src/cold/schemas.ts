import { z } from 'zod';

export const CreateColdStorageSchema = z.object({
  name: z.string().min(1).max(120),
  mode: z.enum(['FRESH', 'FROZEN']).optional(),
  unitId: z.string().min(1).optional(),
  // Optional explicit band; defaults derived from mode (§6) when omitted.
  minTempC: z.number().optional(),
  maxTempC: z.number().optional(),
});

export const RecordTempSchema = z.object({
  temperatureC: z.number(),
  source: z.string().max(20).optional(),
  notes: z.string().max(300).optional(),
});

export type CreateColdStorageInput = z.infer<typeof CreateColdStorageSchema>;
export type RecordTempInput = z.infer<typeof RecordTempSchema>;
