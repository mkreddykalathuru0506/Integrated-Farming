import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { isUnderWithdrawal } from '../health/withdrawal';
import type { CreateProcessingInput } from './schemas';

const LOT_SELECT = {
  id: true,
  lotCode: true,
  qrCode: true,
  productName: true,
  state: true,
  initialQuantityKg: true,
  quantityKg: true,
  status: true,
  producedAt: true,
  expiryDate: true,
  coldStorageId: true,
  sourceBatchId: true,
} satisfies Prisma.ProductLotSelect;

function lotDTO(l: Prisma.ProductLotGetPayload<{ select: typeof LOT_SELECT }>) {
  return {
    id: l.id,
    lotCode: l.lotCode,
    qrCode: l.qrCode,
    productName: l.productName,
    state: l.state,
    initialQuantityKg: l.initialQuantityKg.toString(),
    quantityKg: l.quantityKg.toString(),
    status: l.status,
    producedAt: l.producedAt,
    expiryDate: l.expiryDate,
    coldStorageId: l.coldStorageId,
    sourceBatchId: l.sourceBatchId,
  };
}

/**
 * Slaughter/processing: source batch/animal → product lots.
 * HARD DOMAIN RULE (§6): a batch/animal under an active medication withdrawal
 * period MUST NOT be processed for sale. Blocks until the period elapses.
 */
export async function createProcessing(farmId: string, userId: string, input: CreateProcessingInput) {
  const now = new Date();

  // Validate source belongs to the farm + enforce the withdrawal gate.
  let sourceBatch: { id: string; currentCount: number; status: string } | null = null;
  if (input.sourceBatchId) {
    const b = await prisma.batch.findFirst({
      where: { id: input.sourceBatchId, farmId, deletedAt: null },
      select: { id: true, currentCount: true, status: true },
    });
    if (!b) throw new AppError(422, 'INVALID_BATCH', 'Batch does not belong to this farm');
    sourceBatch = b;
    const meds = await prisma.medicationLog.findMany({ where: { farmId, batchId: b.id }, select: { withdrawalUntil: true } });
    if (isUnderWithdrawal(meds, now)) {
      throw new AppError(422, 'WITHDRAWAL_ACTIVE', 'Cannot process: batch is under a medication withdrawal period');
    }
    if (input.inputCount && input.inputCount > b.currentCount) {
      throw new AppError(422, 'INSUFFICIENT_COUNT', 'inputCount exceeds the batch current count');
    }
  } else if (input.sourceAnimalId) {
    const a = await prisma.animal.findFirst({ where: { id: input.sourceAnimalId, farmId, deletedAt: null }, select: { id: true } });
    if (!a) throw new AppError(422, 'INVALID_ANIMAL', 'Animal does not belong to this farm');
    const meds = await prisma.medicationLog.findMany({ where: { farmId, animalId: a.id }, select: { withdrawalUntil: true } });
    if (isUnderWithdrawal(meds, now)) {
      throw new AppError(422, 'WITHDRAWAL_ACTIVE', 'Cannot process: animal is under a medication withdrawal period');
    }
  }

  // Validate any referenced cold storage belongs to the farm.
  const coldIds = [...new Set(input.lots.map((l) => l.coldStorageId).filter((x): x is string => Boolean(x)))];
  if (coldIds.length) {
    const found = await prisma.coldStorage.count({ where: { id: { in: coldIds }, farmId, deletedAt: null } });
    if (found !== coldIds.length) throw new AppError(422, 'INVALID_COLD_STORAGE', 'Cold storage does not belong to this farm');
  }

  const processedAt = input.processedAt ? new Date(input.processedAt) : now;

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.processingRun.create({
      data: {
        farmId,
        sourceBatchId: input.sourceBatchId,
        sourceAnimalId: input.sourceAnimalId,
        processedAt,
        inputCount: input.inputCount,
        notes: input.notes,
        createdBy: userId,
      },
    });

    // Create each lot, then stamp lotCode + QR from its id (mirrors batch/animal QR).
    for (const l of input.lots) {
      const lot = await tx.productLot.create({
        data: {
          farmId,
          lotCode: 'pending',
          processingRunId: created.id,
          sourceBatchId: input.sourceBatchId,
          productName: l.productName,
          state: l.state ?? 'FRESH',
          initialQuantityKg: new Prisma.Decimal(l.quantityKg),
          quantityKg: new Prisma.Decimal(l.quantityKg),
          coldStorageId: l.coldStorageId,
          expiryDate: l.expiryDate ? new Date(l.expiryDate) : undefined,
          createdBy: userId,
        },
      });
      await tx.productLot.update({ where: { id: lot.id }, data: { lotCode: `IFM-L-${lot.id}`, qrCode: `IFM-L-${lot.id}` } });
    }

    // Slaughtered birds leave the live flock — decrement the source batch atomically.
    if (sourceBatch && input.inputCount) {
      await tx.batch.update({ where: { id: sourceBatch.id }, data: { currentCount: { decrement: input.inputCount }, updatedBy: userId } });
    }

    return tx.processingRun.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        id: true,
        processedAt: true,
        inputCount: true,
        sourceBatchId: true,
        sourceAnimalId: true,
        lots: { select: LOT_SELECT },
      },
    });
  });

  return { id: run.id, processedAt: run.processedAt, inputCount: run.inputCount, sourceBatchId: run.sourceBatchId, sourceAnimalId: run.sourceAnimalId, lots: run.lots.map(lotDTO) };
}

export async function listProcessing(farmId: string) {
  const runs = await prisma.processingRun.findMany({
    where: { farmId },
    orderBy: { processedAt: 'desc' },
    select: {
      id: true,
      processedAt: true,
      inputCount: true,
      sourceBatch: { select: { id: true, code: true } },
      lots: { select: LOT_SELECT },
    },
  });
  return runs.map((r) => ({ id: r.id, processedAt: r.processedAt, inputCount: r.inputCount, sourceBatch: r.sourceBatch, lots: r.lots.map(lotDTO) }));
}

export async function listLots(farmId: string) {
  const lots = await prisma.productLot.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { producedAt: 'desc' },
    select: {
      ...LOT_SELECT,
      sourceBatch: { select: { id: true, code: true, species: { select: { name: true } } } },
      coldStorage: { select: { id: true, name: true } },
    },
  });
  return lots.map((l) => ({
    ...lotDTO(l),
    sourceBatch: l.sourceBatch,
    coldStorage: l.coldStorage,
  }));
}

/** Full traceability: lot → processing run → source batch → species/breed (+ cold storage). */
export async function traceLot(farmId: string, id: string) {
  const lot = await prisma.productLot.findFirst({
    where: { id, farmId, deletedAt: null },
    select: {
      id: true,
      lotCode: true,
      productName: true,
      state: true,
      quantityKg: true,
      producedAt: true,
      coldStorage: { select: { id: true, name: true, mode: true } },
      processingRun: { select: { id: true, processedAt: true, inputCount: true } },
      sourceBatch: {
        select: {
          id: true,
          code: true,
          qrCode: true,
          species: { select: { id: true, name: true } },
          breed: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!lot) throw new AppError(404, 'NOT_FOUND', 'Product lot not found');
  return {
    lot: { id: lot.id, lotCode: lot.lotCode, productName: lot.productName, state: lot.state, quantityKg: lot.quantityKg.toString(), producedAt: lot.producedAt },
    coldStorage: lot.coldStorage,
    processingRun: lot.processingRun,
    sourceBatch: lot.sourceBatch,
  };
}
