import { z } from 'zod';
import { UnitType, FssaiTier } from '@prisma/client';

export const CreateFarmSchema = z.object({
  name: z.string().min(1).max(160),
  state: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
});

export const UpdateFarmSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  state: z.string().max(80).nullable().optional(),
  district: z.string().max(80).nullable().optional(),
});

export const UpdateSettingsSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  currency: z.string().min(1).max(8).optional(),
  defaultLocale: z.string().min(2).max(8).optional(),
  areaUnit: z.string().min(1).max(16).optional(),
  fssaiLicenseNo: z.string().max(20).nullable().optional(),
  fssaiTier: z.nativeEnum(FssaiTier).nullable().optional(),
  gstin: z.string().max(20).nullable().optional(),
  // integer paise — accept a non-negative integer or a digit string; never a float.
  gstThresholdPaise: z
    .union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)])
    .nullable()
    .optional(),
});

export const CreateUnitSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.nativeEnum(UnitType),
  code: z.string().max(40).nullable().optional(),
});

export const UpdateUnitSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: z.nativeEnum(UnitType).optional(),
  code: z.string().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateFarmInput = z.infer<typeof CreateFarmSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;
