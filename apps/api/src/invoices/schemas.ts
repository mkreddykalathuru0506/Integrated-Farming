import { z } from 'zod';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(160),
  gstin: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  state: z.string().max(60).optional(),
  address: z.string().max(300).optional(),
});

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(160),
  gstin: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
});

export const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        hsnSac: z.string().max(20).optional(),
        qty: z.number().positive(),
        unitPricePaise: paise,
        gstRateBps: z.number().int().min(0).max(10000),
        batchId: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

/** PATCH bodies — every field optional (at least one), nullable clears. Strict: unknown keys → 400. */
export const UpdateCustomerSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    gstin: z.string().trim().max(20).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    state: z.string().trim().max(60).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'EMPTY_UPDATE' });

export const UpdateVendorSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    gstin: z.string().trim().max(20).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'EMPTY_UPDATE' });

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;
