import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import type { CreateLogInput } from './schemas';

const SELECT = {
  id: true,
  type: true,
  quantity: true,
  unit: true,
  loggedAt: true,
  batchId: true,
  animalId: true,
  unitId: true,
  clientLogId: true,
} satisfies Prisma.DailyLogSelect;

async function assertTargets(farmId: string, input: CreateLogInput) {
  if (input.batchId) {
    const b = await prisma.batch.findFirst({ where: { id: input.batchId, farmId, deletedAt: null } });
    if (!b) throw new AppError(422, 'INVALID_TARGET', 'Batch does not belong to this farm');
  }
  if (input.animalId) {
    const a = await prisma.animal.findFirst({ where: { id: input.animalId, farmId, deletedAt: null } });
    if (!a) throw new AppError(422, 'INVALID_TARGET', 'Animal does not belong to this farm');
  }
  if (input.unitId) {
    const u = await prisma.unit.findFirst({ where: { id: input.unitId, farmId, deletedAt: null } });
    if (!u) throw new AppError(422, 'INVALID_TARGET', 'Unit does not belong to this farm');
  }
}

export async function createLog(farmId: string, userId: string, input: CreateLogInput) {
  await assertTargets(farmId, input);
  const data = {
    farmId,
    type: input.type,
    batchId: input.batchId,
    animalId: input.animalId,
    unitId: input.unitId,
    quantity: input.quantity,
    unit: input.unit,
    notes: input.notes,
    loggedAt: input.loggedAt ? new Date(input.loggedAt) : new Date(),
    clientLogId: input.clientLogId,
    recordedBy: userId,
  };
  // Idempotent on clientLogId: replays (offline sync) return the existing row.
  if (input.clientLogId) {
    return prisma.dailyLog.upsert({
      where: { clientLogId: input.clientLogId },
      update: {},
      create: data,
      select: SELECT,
    });
  }
  return prisma.dailyLog.create({ data, select: SELECT });
}

export async function listLogs(farmId: string, filter: { type?: string; limit?: number }) {
  const where: Prisma.DailyLogWhereInput = { farmId };
  if (filter.type) where.type = filter.type as Prisma.EnumLogTypeFilter['equals'];
  return prisma.dailyLog.findMany({
    where,
    orderBy: { loggedAt: 'desc' },
    take: Math.min(filter.limit ?? 50, 200),
    select: SELECT,
  });
}
