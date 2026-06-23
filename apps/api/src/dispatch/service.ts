import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { evaluateColdChain } from './calc';
import type { CreateDispatchInput } from './schemas';

const DISPATCH_SELECT = {
  id: true,
  dispatchedAt: true,
  refrigeratedTransport: true,
  vehicleNumber: true,
  dispatchTempC: true,
  coldChainOk: true,
  salesOrder: { select: { id: true, orderNumber: true, status: true } },
  lines: {
    select: {
      id: true,
      qtyKg: true,
      count: true,
      batchId: true,
      productLot: {
        select: {
          id: true,
          lotCode: true,
          productName: true,
          state: true,
          sourceBatch: { select: { id: true, code: true, species: { select: { name: true } } } },
        },
      },
    },
  },
} satisfies Prisma.DispatchSelect;

function dispatchDTO(d: Prisma.DispatchGetPayload<{ select: typeof DISPATCH_SELECT }>) {
  return {
    id: d.id,
    dispatchedAt: d.dispatchedAt,
    refrigeratedTransport: d.refrigeratedTransport,
    vehicleNumber: d.vehicleNumber,
    dispatchTempC: d.dispatchTempC,
    coldChainOk: d.coldChainOk,
    salesOrder: d.salesOrder,
    lines: d.lines.map((l) => ({
      id: l.id,
      qtyKg: l.qtyKg ? l.qtyKg.toString() : null,
      count: l.count,
      batchId: l.batchId,
      productLot: l.productLot,
    })),
  };
}

export async function createDispatch(farmId: string, userId: string, input: CreateDispatchInput) {
  const order = await prisma.salesOrder.findFirst({
    where: { id: input.salesOrderId, farmId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!order) throw new AppError(422, 'INVALID_ORDER', 'Order does not belong to this farm');
  if (order.status !== 'CONFIRMED') {
    throw new AppError(422, 'ORDER_NOT_CONFIRMED', `Only a CONFIRMED order can be dispatched (is ${order.status})`);
  }

  // Resolve + validate each referenced lot; collect product states for the cold-chain gate.
  const lotIds = [...new Set(input.lines.map((l) => l.productLotId).filter((x): x is string => Boolean(x)))];
  const lots = lotIds.length
    ? await prisma.productLot.findMany({
        where: { id: { in: lotIds }, farmId, deletedAt: null },
        select: { id: true, state: true, quantityKg: true, status: true },
      })
    : [];
  const lotById = new Map(lots.map((l) => [l.id, l]));
  if (lots.length !== lotIds.length) throw new AppError(422, 'INVALID_LOT', 'A product lot does not belong to this farm');

  for (const line of input.lines) {
    if (line.batchId) {
      const b = await prisma.batch.count({ where: { id: line.batchId, farmId, deletedAt: null } });
      if (!b) throw new AppError(422, 'INVALID_BATCH', 'A batch does not belong to this farm');
    }
    if (line.productLotId) {
      const lot = lotById.get(line.productLotId)!;
      if (lot.status !== 'AVAILABLE') throw new AppError(422, 'LOT_UNAVAILABLE', 'A product lot is not available');
      if (line.qtyKg && new Prisma.Decimal(line.qtyKg).greaterThan(lot.quantityKg)) {
        throw new AppError(422, 'INSUFFICIENT_LOT_QTY', 'Dispatch qty exceeds the lot remaining quantity');
      }
    }
  }

  const hasFrozen = lots.some((l) => l.state === 'FROZEN');
  const hasFresh = lots.some((l) => l.state === 'FRESH');
  const refrigeratedTransport = input.refrigeratedTransport ?? false;
  const dispatchTempC = input.dispatchTempC ?? null;

  const chain = evaluateColdChain({ hasFrozen, hasFresh, refrigeratedTransport, dispatchTempC });
  if (!chain.ok) throw new AppError(422, 'COLD_CHAIN_FAIL', `Cold chain would break: ${chain.reason}`);

  const dispatch = await prisma.$transaction(async (tx) => {
    const created = await tx.dispatch.create({
      data: {
        farmId,
        salesOrderId: order.id,
        refrigeratedTransport,
        vehicleNumber: input.vehicleNumber,
        dispatchTempC,
        coldChainOk: chain.ok,
        notes: input.notes,
        createdBy: userId,
        lines: {
          create: input.lines.map((l) => ({
            productLotId: l.productLotId,
            batchId: l.batchId,
            qtyKg: l.qtyKg !== undefined ? new Prisma.Decimal(l.qtyKg) : undefined,
            count: l.count,
          })),
        },
      },
    });

    // Decrement allocated lot quantities; mark DEPLETED at zero.
    for (const line of input.lines) {
      if (line.productLotId && line.qtyKg) {
        const lot = lotById.get(line.productLotId)!;
        const remaining = lot.quantityKg.minus(new Prisma.Decimal(line.qtyKg));
        await tx.productLot.update({
          where: { id: line.productLotId },
          data: {
            quantityKg: remaining,
            status: remaining.lessThanOrEqualTo(0) ? 'DEPLETED' : 'AVAILABLE',
            updatedBy: userId,
          },
        });
      }
    }

    await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'DISPATCHED', updatedBy: userId } });

    return tx.dispatch.findUniqueOrThrow({ where: { id: created.id }, select: DISPATCH_SELECT });
  });

  return dispatchDTO(dispatch);
}

export async function listDispatches(farmId: string) {
  const rows = await prisma.dispatch.findMany({ where: { farmId }, orderBy: { dispatchedAt: 'desc' }, select: DISPATCH_SELECT });
  return rows.map(dispatchDTO);
}

export async function getDispatch(farmId: string, id: string) {
  const row = await prisma.dispatch.findFirst({ where: { id, farmId }, select: DISPATCH_SELECT });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Dispatch not found');
  return dispatchDTO(row);
}
