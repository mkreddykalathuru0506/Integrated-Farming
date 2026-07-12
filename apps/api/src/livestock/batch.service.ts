import { Prisma, type BatchStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import { firstStage, nextStage } from './stage-machine';
import type { CreateBatchInput, UpdateBatchInput } from './schemas';

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  initialCount: true,
  currentCount: true,
  status: true,
  qrCode: true,
  species: { select: { id: true, code: true, name: true } },
  breed: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  currentStage: { select: { id: true, name: true, sequence: true, isTerminal: true } },
} satisfies Prisma.BatchSelect;

async function loadStages(farmId: string, speciesId: string) {
  return prisma.lifecycleStage.findMany({
    where: { farmId, speciesId, deletedAt: null },
    select: { id: true, sequence: true, isTerminal: true },
  });
}

export async function createBatch(farmId: string, userId: string, input: CreateBatchInput) {
  const species = await prisma.species.findFirst({
    where: { id: input.speciesId, farmId, deletedAt: null },
  });
  if (!species) throw new AppError(404, 'NOT_FOUND', 'Species not found');
  if (species.trackingMode !== 'BATCH') {
    throw new AppError(422, 'SPECIES_NOT_BATCH', 'This species is tracked as individuals, not batches');
  }
  if (input.breedId) {
    const breed = await prisma.breed.findFirst({
      where: { id: input.breedId, farmId, speciesId: species.id, deletedAt: null },
    });
    if (!breed) throw new AppError(422, 'INVALID_BREED', 'Breed does not belong to this species');
  }
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, farmId, deletedAt: null } });
    if (!unit) throw new AppError(422, 'INVALID_UNIT', 'Unit does not belong to this farm');
  }

  const stages = await loadStages(farmId, species.id);
  const start = firstStage(stages);

  try {
    const batch = await prisma.batch.create({
      data: {
        farmId,
        speciesId: species.id,
        breedId: input.breedId,
        unitId: input.unitId,
        code: input.code,
        name: input.name,
        initialCount: input.initialCount,
        currentCount: input.initialCount,
        currentStageId: start?.id,
        source: input.source,
        acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : undefined,
        createdBy: userId,
      },
    });
    return prisma.batch.update({
      where: { id: batch.id },
      data: { qrCode: `IFM-B-${batch.id}` },
      select: LIST_SELECT,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'BATCH_CODE_TAKEN', 'A batch with this code already exists');
    }
    throw err;
  }
}

export type BatchListFilter = { q?: string; status?: BatchStatus; from?: Date; to?: Date };

/** Shared where-builder so the legacy list and the paged list can't drift. */
function batchWhere(farmId: string, f: BatchListFilter): Prisma.BatchWhereInput {
  const where: Prisma.BatchWhereInput = { farmId, deletedAt: null };
  if (f.q) where.OR = [{ code: contains(f.q) }, { name: contains(f.q) }];
  if (f.status) where.status = f.status;
  const range = dateRange(f.from, f.to);
  if (range) where.createdAt = range;
  return where;
}

export async function listBatches(farmId: string, filter: BatchListFilter = {}) {
  return prisma.batch.findMany({
    where: batchWhere(farmId, filter),
    orderBy: { createdAt: 'desc' },
    select: LIST_SELECT,
  });
}

export async function listBatchesPaged(farmId: string, p: ListQuery & BatchListFilter) {
  const where = batchWhere(farmId, p);
  const [items, total] = await Promise.all([
    prisma.batch.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(p), select: LIST_SELECT }),
    prisma.batch.count({ where }),
  ]);
  return envelope(items, total, p);
}

async function findBatchInFarm(farmId: string, id: string) {
  const batch = await prisma.batch.findFirst({ where: { id, farmId, deletedAt: null } });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  return batch;
}

export async function getBatch(farmId: string, id: string) {
  await findBatchInFarm(farmId, id);
  return prisma.batch.findUnique({ where: { id }, select: LIST_SELECT });
}

export async function updateBatch(farmId: string, id: string, userId: string, input: UpdateBatchInput) {
  await findBatchInFarm(farmId, id);
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, farmId, deletedAt: null } });
    if (!unit) throw new AppError(422, 'INVALID_UNIT', 'Unit does not belong to this farm');
  }
  return prisma.batch.update({
    where: { id },
    data: { name: input.name, unitId: input.unitId, source: input.source, updatedBy: userId },
    select: LIST_SELECT,
  });
}

export async function advanceStage(farmId: string, id: string, userId: string) {
  const batch = await findBatchInFarm(farmId, id);
  if (batch.status !== 'ACTIVE') throw new AppError(422, 'BATCH_CLOSED', 'Batch is closed');
  const stages = await loadStages(farmId, batch.speciesId);
  const current = batch.currentStageId
    ? stages.find((s) => s.id === batch.currentStageId)
    : undefined;
  const target = current ? nextStage(stages, current.sequence) : firstStage(stages);
  if (!target) throw new AppError(422, 'NO_NEXT_STAGE', 'Batch is already at the final stage');
  return prisma.batch.update({
    where: { id },
    data: { currentStageId: target.id, updatedBy: userId },
    select: LIST_SELECT,
  });
}

export async function closeBatch(farmId: string, id: string, userId: string) {
  await findBatchInFarm(farmId, id);
  return prisma.batch.update({
    where: { id },
    data: { status: 'CLOSED', updatedBy: userId },
    select: LIST_SELECT,
  });
}
