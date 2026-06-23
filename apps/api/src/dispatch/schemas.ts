import { z } from 'zod';

export const CreateDispatchSchema = z.object({
  salesOrderId: z.string().min(1),
  refrigeratedTransport: z.boolean().optional(),
  vehicleNumber: z.string().max(40).optional(),
  dispatchTempC: z.number().optional(),
  notes: z.string().max(500).optional(),
  lines: z
    .array(
      z
        .object({
          productLotId: z.string().min(1).optional(),
          batchId: z.string().min(1).optional(),
          qtyKg: z.number().positive().optional(),
          count: z.number().int().positive().optional(),
        })
        .refine((l) => Boolean(l.productLotId) || Boolean(l.batchId), {
          message: 'Each line needs a product lot or a batch',
        }),
    )
    .min(1),
});

export type CreateDispatchInput = z.infer<typeof CreateDispatchSchema>;
