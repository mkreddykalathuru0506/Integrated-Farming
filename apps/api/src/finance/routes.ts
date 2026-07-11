import { Router } from 'express';
import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import { CreateExpenseSchema, UpdateExpenseSchema } from './schemas';
import * as finance from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

const ExpenseListSchema = ListQuerySchema.extend({
  status: z.nativeEnum(ExpenseCategory).optional(),
  batchId: z.string().optional(),
  category: z.string().optional(), // legacy param, passed through as before
});

/** /api/farm/expenses — costs (member reads; OWNER/MANAGER/ACCOUNTANT writes). */
export const expenseRouter = Router();
expenseRouter.use(requireAuth, requireFarmAccess);

expenseRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = ExpenseListSchema.parse(req.query);
    if (p.page) res.json(await finance.listExpensesPaged(farmScope(req).farmId, p));
    else res.json({ expenses: await finance.listExpenses(farmScope(req).farmId, p) });
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

expenseRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = UpdateExpenseSchema.parse(req.body);
    res.json({ expense: await finance.updateExpense(farmScope(req).farmId, req.userId!, req.params.id!, input) });
  }),
);

expenseRouter.delete(
  '/:id',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    res.json(await finance.deleteExpense(farmScope(req).farmId, req.userId!, req.params.id!));
  }),
);
