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

export type CreateFeedItemInput = z.infer<typeof CreateFeedItemSchema>;
export type PurchaseInput = z.infer<typeof PurchaseSchema>;
