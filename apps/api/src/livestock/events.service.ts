import { prisma } from '../prisma';
import { AppError } from '../errors';
import { isValidLoss } from './counts';
import type { RecordMortalityInput, RecordMovementInput } from './schemas';

export async function recordMortality(farmId: string, userId: string, input: RecordMortalityInput) {
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : undefined;

  if (input.animalId) {
    const animal = await prisma.animal.findFirst({
      where: { id: input.animalId, farmId, deletedAt: null },
    });
    if (!animal) throw new AppError(404, 'NOT_FOUND', 'Animal not found');
    if (animal.status !== 'ACTIVE') {
      throw new AppError(422, 'ALREADY_INACTIVE', 'Animal is not active');
    }
    const newStatus = input.type === 'CULL' ? 'CULLED' : 'DEAD';
    const [, event] = await prisma.$transaction([
      prisma.animal.update({ where: { id: animal.id }, data: { status: newStatus, updatedBy: userId } }),
      prisma.mortalityEvent.create({
        data: { farmId, animalId: animal.id, type: input.type, count: 1, cause: input.cause, notes: input.notes, occurredAt, createdBy: userId },
      }),
    ]);
    return { event, animalStatus: newStatus };
  }

  const batch = await prisma.batch.findFirst({ where: { id: input.batchId, farmId, deletedAt: null } });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  if (batch.status !== 'ACTIVE') throw new AppError(422, 'BATCH_CLOSED', 'Batch is closed');
  const count = input.count ?? 1;
  if (!isValidLoss(batch.currentCount, count)) {
    throw new AppError(422, 'INVALID_COUNT', `Count must be between 1 and ${batch.currentCount}`);
  }
  const [updated, event] = await prisma.$transaction([
    prisma.batch.update({ where: { id: batch.id }, data: { currentCount: batch.currentCount - count, updatedBy: userId } }),
    prisma.mortalityEvent.create({
      data: { farmId, batchId: batch.id, type: input.type, count, cause: input.cause, notes: input.notes, occurredAt, createdBy: userId },
    }),
  ]);
  return { event, currentCount: updated.currentCount };
}

export async function recordMovement(farmId: string, userId: string, input: RecordMovementInput) {
  const toUnit = await prisma.unit.findFirst({ where: { id: input.toUnitId, farmId, deletedAt: null } });
  if (!toUnit) throw new AppError(422, 'INVALID_UNIT', 'Target unit does not belong to this farm');

  if (input.animalId) {
    const animal = await prisma.animal.findFirst({ where: { id: input.animalId, farmId, deletedAt: null } });
    if (!animal) throw new AppError(404, 'NOT_FOUND', 'Animal not found');
    const [, movement] = await prisma.$transaction([
      prisma.animal.update({ where: { id: animal.id }, data: { unitId: toUnit.id, updatedBy: userId } }),
      prisma.movement.create({
        data: { farmId, animalId: animal.id, fromUnitId: animal.unitId, toUnitId: toUnit.id, reason: input.reason, createdBy: userId },
      }),
    ]);
    return movement;
  }

  const batch = await prisma.batch.findFirst({ where: { id: input.batchId, farmId, deletedAt: null } });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');
  const [, movement] = await prisma.$transaction([
    prisma.batch.update({ where: { id: batch.id }, data: { unitId: toUnit.id, updatedBy: userId } }),
    prisma.movement.create({
      data: { farmId, batchId: batch.id, count: batch.currentCount, fromUnitId: batch.unitId, toUnitId: toUnit.id, reason: input.reason, createdBy: userId },
    }),
  ]);
  return movement;
}
