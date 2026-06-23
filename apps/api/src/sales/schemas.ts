import { z } from 'zod';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateOrderSchema = z.object({
  customerId: z.string().min(1),
  expectedDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        qty: z.number().positive(),
        unit: z.string().max(20).optional(),
        unitPricePaise: paise,
        batchId: z.string().min(1).optional(),
        productLotId: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
