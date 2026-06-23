import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { rollup } from './circularity';
import type { CreateTransferInput } from './schemas';

const TRANSFER_SELECT = {
  id: true,
  byproductType: true,
  fromUnitId: true,
  toUnitId: true,
  sourceBatchId: true,
  quantity: true,
  unit: true,
  creditPaise: true,
  transferredAt: true,
  notes: true,
} satisfies Prisma.ByproductTransferSelect;

function transferDTO(t: Prisma.ByproductTransferGetPayload<{ select: typeof TRANSFER_SELECT }>) {
  return {
    id: t.id,
    byproductType: t.byproductType,
    fromUnitId: t.fromUnitId,
    toUnitId: t.toUnitId,
    sourceBatchId: t.sourceBatchId,
    quantity: t.quantity.toString(),
    unit: t.unit,
    creditPaise: t.creditPaise.toString(),
    transferredAt: t.transferredAt,
    notes: t.notes,
  };
}

async function assertUnit(farmId: string, unitId: string | undefined) {
  if (!unitId) return;
  const unit = await prisma.unit.findFirst({ where: { id: unitId, farmId, deletedAt: null } });
  if (!unit) throw new AppError(422, 'INVALID_UNIT', 'Unit does not belong to this farm');
}

export async function createTransfer(farmId: string, userId: string, input: CreateTransferInput) {
  await assertUnit(farmId, input.fromUnitId);
  await assertUnit(farmId, input.toUnitId);
  if (input.sourceBatchId) {
    const batch = await prisma.batch.findFirst({ where: { id: input.sourceBatchId, farmId, deletedAt: null } });
    if (!batch) throw new AppError(422, 'INVALID_BATCH', 'Batch does not belong to this farm');
  }
  const transfer = await prisma.byproductTransfer.create({
    data: {
      farmId,
      byproductType: input.byproductType,
      fromUnitId: input.fromUnitId,
      toUnitId: input.toUnitId,
      sourceBatchId: input.sourceBatchId,
      quantity: new Prisma.Decimal(input.quantity),
      unit: input.unit ?? 'kg',
      creditPaise: input.creditPaise !== undefined ? BigInt(input.creditPaise) : 0n,
      transferredAt: input.transferredAt ? new Date(input.transferredAt) : undefined,
      notes: input.notes,
      createdBy: userId,
    },
    select: TRANSFER_SELECT,
  });
  return transferDTO(transfer);
}

export async function listTransfers(farmId: string) {
  const rows = await prisma.byproductTransfer.findMany({ where: { farmId }, orderBy: { transferredAt: 'desc' }, select: TRANSFER_SELECT });
  return rows.map(transferDTO);
}

/** Circularity savings rollup: total + by type + by destination unit (with names). */
export async function circularity(farmId: string) {
  const [rows, units] = await Promise.all([
    prisma.byproductTransfer.findMany({
      where: { farmId },
      select: { byproductType: true, toUnitId: true, quantity: true, creditPaise: true },
    }),
    prisma.unit.findMany({ where: { farmId, deletedAt: null }, select: { id: true, name: true } }),
  ]);
  const unitName = new Map(units.map((u) => [u.id, u.name]));

  const agg = rollup(
    rows.map((r) => ({
      byproductType: r.byproductType,
      toUnitId: r.toUnitId,
      quantity: Number(r.quantity),
      creditPaise: r.creditPaise,
    })),
  );

  return {
    totalCreditPaise: agg.totalCreditPaise.toString(),
    totalQuantity: agg.totalQuantity,
    transferCount: agg.transferCount,
    byType: agg.byType.map((t) => ({ type: t.type, creditPaise: t.creditPaise.toString(), quantity: t.quantity, count: t.count })),
    byDestination: agg.byDestination.map((d) => ({
      unitId: d.unitId,
      unitName: d.unitId ? unitName.get(d.unitId) ?? null : null,
      creditPaise: d.creditPaise.toString(),
      count: d.count,
    })),
  };
}
