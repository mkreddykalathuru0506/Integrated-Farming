import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  amountPaise: paise,
  occurredAt: z.string().datetime().optional(),
  description: z.string().max(300).optional(),
  batchId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
