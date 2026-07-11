import { Prisma, type SalesOrderStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import { lineTotalPaise, orderTotalPaise } from './calc';
import type { CreateOrderInput, UpdateOrderStatusInput } from './schemas';

/** Indian financial year label for a date (Apr–Mar), e.g. "2026-27". */
function financialYear(d: Date): string {
  const y = d.getUTCFullYear();
  const startYear = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  orderDate: true,
  expectedDate: true,
  totalPaise: true,
  notes: true,
  customer: { select: { id: true, name: true, state: true } },
  lines: {
    select: {
      id: true,
      description: true,
      qty: true,
      unit: true,
      unitPricePaise: true,
      lineTotalPaise: true,
      batchId: true,
      productLotId: true,
    },
  },
} satisfies Prisma.SalesOrderSelect;

type OrderRow = Prisma.SalesOrderGetPayload<{ select: typeof ORDER_SELECT }>;

function toOrderDTO(o: OrderRow) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    orderDate: o.orderDate,
    expectedDate: o.expectedDate,
    totalPaise: o.totalPaise.toString(),
    notes: o.notes,
    customer: o.customer,
    lines: o.lines.map((l) => ({
      id: l.id,
      description: l.description,
      qty: l.qty.toString(),
      unit: l.unit,
      unitPricePaise: l.unitPricePaise.toString(),
      lineTotalPaise: l.lineTotalPaise.toString(),
      batchId: l.batchId,
      productLotId: l.productLotId,
    })),
  };
}

export async function createOrder(farmId: string, userId: string, input: CreateOrderInput) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, farmId, deletedAt: null } });
  if (!customer) throw new AppError(422, 'INVALID_CUSTOMER', 'Customer does not belong to this farm');

  const lines = input.lines.map((l) => {
    const total = lineTotalPaise(l.qty, Number(l.unitPricePaise));
    return {
      description: l.description,
      qty: new Prisma.Decimal(l.qty),
      unit: l.unit ?? 'kg',
      unitPricePaise: BigInt(l.unitPricePaise),
      lineTotalPaise: total,
      batchId: l.batchId,
      productLotId: l.productLotId,
    };
  });
  const total = orderTotalPaise(lines);
  const orderDate = new Date();
  const fy = financialYear(orderDate);

  const order = await prisma.$transaction(async (tx) => {
    const count = await tx.salesOrder.count({ where: { farmId, orderNumber: { startsWith: `SO-${fy}-` } } });
    const orderNumber = `SO-${fy}-${String(count + 1).padStart(4, '0')}`;
    return tx.salesOrder.create({
      data: {
        farmId,
        orderNumber,
        customerId: customer.id,
        orderDate,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : undefined,
        totalPaise: total,
        notes: input.notes,
        createdBy: userId,
        lines: { create: lines },
      },
      select: ORDER_SELECT,
    });
  });

  return toOrderDTO(order);
}

export type OrderListFilter = { q?: string; status?: SalesOrderStatus; from?: Date; to?: Date };

function orderWhere(farmId: string, f: OrderListFilter): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = { farmId, deletedAt: null };
  if (f.q) where.OR = [{ orderNumber: contains(f.q) }, { customer: { name: contains(f.q) } }];
  if (f.status) where.status = f.status;
  const range = dateRange(f.from, f.to);
  if (range) where.orderDate = range;
  return where;
}

export async function listOrders(farmId: string, filter: OrderListFilter = {}) {
  const rows = await prisma.salesOrder.findMany({
    where: orderWhere(farmId, filter),
    orderBy: { orderDate: 'desc' },
    select: ORDER_SELECT,
  });
  return rows.map(toOrderDTO);
}

export async function listOrdersPaged(farmId: string, p: ListQuery & OrderListFilter) {
  const where = orderWhere(farmId, p);
  const [rows, total] = await Promise.all([
    prisma.salesOrder.findMany({ where, orderBy: { orderDate: 'desc' }, ...skipTake(p), select: ORDER_SELECT }),
    prisma.salesOrder.count({ where }),
  ]);
  return envelope(rows.map(toOrderDTO), total, p);
}

export async function getOrder(farmId: string, id: string) {
  const order = await prisma.salesOrder.findFirst({ where: { id, farmId, deletedAt: null }, select: ORDER_SELECT });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  return toOrderDTO(order);
}

/** DRAFT → CONFIRMED / CANCELLED. Only a DRAFT order can transition here. */
export async function setOrderStatus(farmId: string, id: string, userId: string, input: UpdateOrderStatusInput) {
  const order = await prisma.salesOrder.findFirst({ where: { id, farmId, deletedAt: null }, select: { status: true } });
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (order.status !== 'DRAFT') {
    throw new AppError(422, 'BAD_TRANSITION', `Cannot ${input.status.toLowerCase()} an order in ${order.status}`);
  }
  const updated = await prisma.salesOrder.update({
    where: { id },
    data: { status: input.status, updatedBy: userId },
    select: ORDER_SELECT,
  });
  return toOrderDTO(updated);
}
