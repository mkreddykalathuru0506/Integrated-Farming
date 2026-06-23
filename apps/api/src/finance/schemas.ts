import { z } from 'zod';
import { ExpenseCategory, InsuranceType } from '@prisma/client';

const paise = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);

export const CreateLoanSchema = z.object({
  lender: z.string().min(1).max(120),
  principalPaise: paise,
  emiAmountPaise: paise.optional(),
  interestRateBps: z.number().int().nonnegative().optional(),
  tenureMonths: z.number().int().positive().optional(),
  startDate: z.string().datetime(),
  nextDueDate: z.string().datetime().optional(),
  notes: z.string().max(300).optional(),
});

export const LoanPaymentSchema = z.object({
  amountPaise: paise,
  paidAt: z.string().datetime().optional(),
});

export const CreateInsuranceSchema = z.object({
  provider: z.string().min(1).max(120),
  policyNumber: z.string().max(60).optional(),
  type: z.nativeEnum(InsuranceType),
  premiumPaise: paise,
  sumInsuredPaise: paise.optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().max(300).optional(),
});

export type CreateLoanInput = z.infer<typeof CreateLoanSchema>;
export type LoanPaymentInput = z.infer<typeof LoanPaymentSchema>;
export type CreateInsuranceInput = z.infer<typeof CreateInsuranceSchema>;

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
