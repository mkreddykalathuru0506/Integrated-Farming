import { z } from 'zod';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateFeedItemSchema = z.object({
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(16).optional(),
  reorderThreshold: z.number().nonnegative().optional(),
});

export const PurchaseSchema = z.object({
  feedItemId: z.string().min(1),
  qty: z.number().positive(),
  unitPricePaise: paise,
  vendorId: z.string().min(1).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const ConsumeSchema = z.object({
  feedItemId: z.string().min(1),
  batchId: z.string().min(1),
  qty: z.number().positive(),
  occurredAt: z.string().datetime().optional(),
});

/**
 * PATCH body — name/unit/reorderThreshold only. Strict: transaction-derived fields
 * (stockQty, lastUnitPricePaise) are unknown keys → 400 VALIDATION.
 */
export const UpdateFeedItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    unit: z.string().trim().min(1).max(16).optional(),
    reorderThreshold: z.number().nonnegative().nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'EMPTY_UPDATE' });

export type CreateFeedItemInput = z.infer<typeof CreateFeedItemSchema>;
export type UpdateFeedItemInput = z.infer<typeof UpdateFeedItemSchema>;
export type PurchaseInput = z.infer<typeof PurchaseSchema>;
export type ConsumeInput = z.infer<typeof ConsumeSchema>;
