import { prisma } from '../prisma';
import { AppError } from '../errors';
import { activeUntil, isUnderWithdrawal } from './withdrawal';
import type { CreateHealthRecordInput, RecordMedicationInput, SaleReadyInput } from './schemas';

type Target = { animalId?: string; batchId?: string };

async function assertTarget(farmId: string, t: Target) {
  if (t.animalId) {
    const a = await prisma.animal.findFirst({ where: { id: t.animalId, farmId, deletedAt: null } });
    if (!a) throw new AppError(422, 'INVALID_TARGET', 'Animal does not belong to this farm');
  }
  if (t.batchId) {
    const b = await prisma.batch.findFirst({ where: { id: t.batchId, farmId, deletedAt: null } });
    if (!b) throw new AppError(422, 'INVALID_TARGET', 'Batch does not belong to this farm');
  }
}

export async function createHealthRecord(farmId: string, userId: string, input: CreateHealthRecordInput) {
  await assertTarget(farmId, input);
  return prisma.healthRecord.create({
    data: {
      farmId,
      animalId: input.animalId,
      batchId: input.batchId,
      type: input.type,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      description: input.description,
      vetName: input.vetName,
      diagnosis: input.diagnosis,
      createdBy: userId,
    },
    select: { id: true, type: true, occurredAt: true, description: true, vetName: true, animalId: true, batchId: true },
  });
}

export async function listHealthRecords(farmId: string, t: Target) {
  return prisma.healthRecord.findMany({
    where: { farmId, animalId: t.animalId, batchId: t.batchId },
    orderBy: { occurredAt: 'desc' },
    select: { id: true, type: true, occurredAt: true, description: true, vetName: true, animalId: true, batchId: true },
  });
}

export async function recordMedication(farmId: string, userId: string, input: RecordMedicationInput) {
  await assertTarget(farmId, input);
  const administeredAt = input.administeredAt ? new Date(input.administeredAt) : new Date();
  const withdrawalUntil = new Date(administeredAt.getTime() + input.withdrawalDays * 86_400_000);
  return prisma.medicationLog.create({
    data: {
      farmId,
      animalId: input.animalId,
      batchId: input.batchId,
      drugName: input.drugName,
      dose: input.dose,
      route: input.route,
      administeredAt,
      withdrawalDays: input.withdrawalDays,
      withdrawalUntil,
      createdBy: userId,
    },
    select: { id: true, drugName: true, administeredAt: true, withdrawalUntil: true },
  });
}

async function medsFor(farmId: string, t: Target) {
  return prisma.medicationLog.findMany({
    where: { farmId, animalId: t.animalId, batchId: t.batchId },
    select: { withdrawalUntil: true },
  });
}

export async function getWithdrawalStatus(farmId: string, t: Target) {
  await assertTarget(farmId, t);
  const meds = await medsFor(farmId, t);
  const now = new Date();
  return { underWithdrawal: isUnderWithdrawal(meds, now), until: activeUntil(meds, now) };
}

export async function markSaleReady(farmId: string, userId: string, input: SaleReadyInput) {
  await assertTarget(farmId, input);
  const meds = await medsFor(farmId, input);
  if (isUnderWithdrawal(meds, new Date())) {
    throw new AppError(422, 'WITHDRAWAL_ACTIVE', 'Cannot mark sale-ready: under medication withdrawal period');
  }
  const now = new Date();
  if (input.animalId) {
    return prisma.animal.update({
      where: { id: input.animalId },
      data: { saleReadyAt: now, updatedBy: userId },
      select: { id: true, saleReadyAt: true },
    });
  }
  return prisma.batch.update({
    where: { id: input.batchId },
    data: { saleReadyAt: now, updatedBy: userId },
    select: { id: true, saleReadyAt: true },
  });
}
