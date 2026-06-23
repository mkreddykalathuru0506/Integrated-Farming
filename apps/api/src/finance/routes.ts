import { Router } from 'express';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateExpenseSchema } from './schemas';
import * as finance from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** /api/farm/expenses — costs (member reads; OWNER/MANAGER/ACCOUNTANT writes). */
export const expenseRouter = Router();
expenseRouter.use(requireAuth, requireFarmAccess);

expenseRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ expenses: await finance.listExpenses(farmScope(req).farmId, { batchId: q(req.query.batchId), category: q(req.query.category) }) });
  }),
);

expenseRouter.get(
  '/batch-cost',
  asyncHandler(async (req, res) => {
    const batchId = q(req.query.batchId);
    if (!batchId) throw new AppError(400, 'BATCH_REQUIRED', 'batchId query is required');
    res.json(await finance.batchCost(farmScope(req).farmId, batchId));
  }),
);

expenseRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateExpenseSchema.parse(req.body);
    res.status(201).json({ expense: await finance.createExpense(farmScope(req).farmId, req.userId!, input) });
  }),
);
