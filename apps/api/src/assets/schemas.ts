import { z } from 'zod';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['EQUIPMENT', 'VEHICLE', 'MACHINERY', 'BUILDING', 'TOOL', 'OTHER']).optional(),
  code: z.string().max(60).optional(),
  unitId: z.string().min(1).optional(),
  purchaseDate: z.string().datetime().optional(),
  purchaseCostPaise: paise.optional(),
  notes: z.string().max(500).optional(),
});

export const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(160),
  intervalDays: z.number().int().positive(),
  nextDueDate: z.string().datetime(),
});

export const RecordMaintenanceSchema = z.object({
  scheduleId: z.string().min(1).optional(),
  type: z.enum(['SERVICE', 'REPAIR', 'INSPECTION', 'CALIBRATION', 'OTHER']).optional(),
  performedAt: z.string().datetime().optional(),
  costPaise: paise.optional(),
  vendor: z.string().max(160).optional(),
  notes: z.string().max(500).optional(),
});

export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type RecordMaintenanceInput = z.infer<typeof RecordMaintenanceSchema>;
