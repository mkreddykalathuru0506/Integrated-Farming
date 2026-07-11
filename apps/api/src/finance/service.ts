import { Prisma, type ExpenseCategory } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import { perUnitPaise } from './calc';
import type { CreateExpenseInput, UpdateExpenseInput } from './schemas';

export async function createExpense(farmId: string, userId: string, input: CreateExpenseInput) {
  if (input.batchId) {
    const b = await prisma.batch.findFirst({ where: { id: input.batchId, farmId, deletedAt: null } });
    if (!b) throw new AppError(422, 'INVALID_TARGET', 'Batch does not belong to this farm');
  }
  const e = await prisma.expense.create({
    data: {
      farmId,
      category: input.category,
      amountPaise: BigInt(input.amountPaise),
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      description: input.description,
      batchId: input.batchId,
      unitId: input.unitId,
      vendorId: input.vendorId,
      createdBy: userId,
    },
    select: { id: true, category: true, amountPaise: true, occurredAt: true, batchId: true, description: true },
  });
  return { ...e, amountPaise: e.amountPaise.toString() };
}

const EXPENSE_SELECT = {
  id: true,
  category: true,
  amountPaise: true,
  occurredAt: true,
  batchId: true,
  description: true,
} satisfies Prisma.ExpenseSelect;

const expenseDTO = (e: Prisma.ExpenseGetPayload<{ select: typeof EXPENSE_SELECT }>) => ({
  ...e,
  amountPaise: e.amountPaise.toString(),
});

export type ExpenseListFilter = {
  batchId?: string;
  category?: string;
  q?: string;
  status?: ExpenseCategory; // `status` maps to the category enum (validated at the route)
  from?: Date;
  to?: Date;
};

function expenseWhere(farmId: string, f: ExpenseListFilter): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = { farmId, deletedAt: null };
  if (f.batchId) where.batchId = f.batchId;
  if (f.category) where.category = f.category as Prisma.EnumExpenseCategoryFilter['equals'];
  if (f.status) where.category = f.status;
  if (f.q) where.description = contains(f.q);
  const range = dateRange(f.from, f.to);
  if (range) where.occurredAt = range;
  return where;
}

export async function listExpenses(farmId: string, filter: ExpenseListFilter) {
  const rows = await prisma.expense.findMany({
    where: expenseWhere(farmId, filter),
    orderBy: { occurredAt: 'desc' },
    select: EXPENSE_SELECT,
  });
  return rows.map(expenseDTO);
}

export async function listExpensesPaged(farmId: string, p: ListQuery & ExpenseListFilter) {
  const where = expenseWhere(farmId, p);
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { occurredAt: 'desc' }, ...skipTake(p), select: EXPENSE_SELECT }),
    prisma.expense.count({ where }),
  ]);
  return envelope(rows.map(expenseDTO), total, p);
}

/** Edit an expense (soft-deleted rows are invisible → 404). `null` clears a nullable field. */
export async function updateExpense(farmId: string, userId: string, id: string, input: UpdateExpenseInput) {
  const existing = await prisma.expense.findFirst({ where: { id, farmId, deletedAt: null }, select: { id: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Expense not found');
  if (input.batchId) {
    const b = await prisma.batch.findFirst({ where: { id: input.batchId, farmId, deletedAt: null } });
    if (!b) throw new AppError(422, 'INVALID_TARGET', 'Batch does not belong to this farm');
  }
  const e = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      category: input.category,
      amountPaise: input.amountPaise !== undefined ? BigInt(input.amountPaise) : undefined,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      description: input.description,
      batchId: input.batchId,
      unitId: input.unitId,
      vendorId: input.vendorId,
      updatedBy: userId,
    },
    select: EXPENSE_SELECT,
  });
  return expenseDTO(e);
}

/** Soft-delete an expense — hides it from every read (list, batch cost, P&L, summaries). */
export async function deleteExpense(farmId: string, userId: string, id: string) {
  const { count } = await prisma.expense.updateMany({
    where: { id, farmId, deletedAt: null },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
  if (count === 0) throw new AppError(404, 'NOT_FOUND', 'Expense not found');
  return { ok: true as const, id };
}

export async function batchCost(farmId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, farmId, deletedAt: null },
    select: { id: true, currentCount: true },
  });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

  const [feed, expenses] = await Promise.all([
    prisma.feedTransaction.findMany({ where: { farmId, batchId, type: 'CONSUMPTION' }, select: { totalPaise: true } }),
    prisma.expense.findMany({ where: { farmId, batchId, deletedAt: null }, select: { category: true, amountPaise: true } }),
  ]);

  const feedCostPaise = feed.reduce((s, f) => s + (f.totalPaise ?? 0n), 0n);
  const byCategory: Record<string, bigint> = { FEED: feedCostPaise };
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0n) + e.amountPaise;

  const totalPaise = Object.values(byCategory).reduce((s, v) => s + v, 0n);

  return {
    totalPaise: totalPaise.toString(),
    costPerBirdPaise: perUnitPaise(totalPaise, batch.currentCount).toString(),
    currentCount: batch.currentCount,
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, v.toString()])),
  };
}
