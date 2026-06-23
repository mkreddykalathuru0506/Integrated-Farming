import { z } from 'zod';
import { WageType, AttendanceStatus } from '@prisma/client';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateWorkerSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).optional(),
  designation: z.string().max(80).optional(),
  wageType: z.nativeEnum(WageType).optional(),
  dailyWageRatePaise: paise.nullable().optional(),
  userId: z.string().min(1).optional(),
});

export const UpdateWorkerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(20).nullable().optional(),
  designation: z.string().max(80).nullable().optional(),
  wageType: z.nativeEnum(WageType).optional(),
  dailyWageRatePaise: paise.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const MarkAttendanceSchema = z.object({
  workerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string().max(300).optional(),
});

export type CreateWorkerInput = z.infer<typeof CreateWorkerSchema>;
export type UpdateWorkerInput = z.infer<typeof UpdateWorkerSchema>;
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>;
