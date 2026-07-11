import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateInsuranceSchema, CreateLoanSchema, LoanPaymentSchema } from './schemas';
import * as loans from './loan.service';
import { financeSummary } from './summary';

const SummaryQuerySchema = z.object({
  granularity: z.enum(['month']).default('month'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const write = requireRole('OWNER', 'MANAGER', 'ACCOUNTANT');

/** /api/farm/loans */
export const loanRouter = Router();
loanRouter.use(requireAuth, requireFarmAccess);
loanRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ loans: await loans.listLoans(farmScope(req).farmId) });
  }),
);
loanRouter.post(
  '/',
  write,
  asyncHandler(async (req, res) => {
    const input = CreateLoanSchema.parse(req.body);
    res.status(201).json({ loan: await loans.createLoan(farmScope(req).farmId, req.userId!, input) });
  }),
);
loanRouter.post(
  '/:id/payments',
  write,
  asyncHandler(async (req, res) => {
    const input = LoanPaymentSchema.parse(req.body);
    res.status(201).json({ payment: await loans.recordLoanPayment(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);

/** /api/farm/insurance */
export const insuranceRouter = Router();
insuranceRouter.use(requireAuth, requireFarmAccess);
insuranceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ policies: await loans.listInsurance(farmScope(req).farmId) });
  }),
);
insuranceRouter.post(
  '/',
  write,
  asyncHandler(async (req, res) => {
    const input = CreateInsuranceSchema.parse(req.body);
    res.status(201).json({ policy: await loans.createInsurance(farmScope(req).farmId, req.userId!, input) });
  }),
);

/** /api/farm/finance — cross-cutting finance reads (reminders, monthly summary). */
export const financeRouter = Router();
financeRouter.use(requireAuth, requireFarmAccess);
financeRouter.get(
  '/reminders',
  asyncHandler(async (req, res) => {
    res.json(await loans.reminders(farmScope(req).farmId));
  }),
);
// Monthly revenue/expense/feed-cost/profit buckets (IST months; default window = current Indian FY).
financeRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const p = SummaryQuerySchema.parse(req.query);
    res.json(await financeSummary(farmScope(req).farmId, p));
  }),
);
