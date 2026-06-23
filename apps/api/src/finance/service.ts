import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { perUnitPaise } from './calc';
import type { CreateExpenseInput } from './schemas';

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

export async function listExpenses(farmId: string, filter: { batchId?: string; category?: string }) {
  const where: Prisma.ExpenseWhereInput = { farmId };
  if (filter.batchId) where.batchId = filter.batchId;
  if (filter.category) where.category = filter.category as Prisma.EnumExpenseCategoryFilter['equals'];
  const rows = await prisma.expense.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    select: { id: true, category: true, amountPaise: true, occurredAt: true, batchId: true, description: true },
  });
  return rows.map((e) => ({ ...e, amountPaise: e.amountPaise.toString() }));
}

export async function batchCost(farmId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, farmId, deletedAt: null },
    select: { id: true, currentCount: true },
  });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

  const [feed, expenses] = await Promise.all([
    prisma.feedTransaction.findMany({ where: { farmId, batchId, type: 'CONSUMPTION' }, select: { totalPaise: true } }),
    prisma.expense.findMany({ where: { farmId, batchId }, select: { category: true, amountPaise: true } }),
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
