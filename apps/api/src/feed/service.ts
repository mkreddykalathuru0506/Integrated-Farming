import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { fcr, purchaseTotalPaise } from './calc';
import type { ConsumeInput, CreateFeedItemInput, PurchaseInput } from './schemas';

type ItemRow = {
  id: string;
  name: string;
  unit: string;
  stockQty: Prisma.Decimal;
  reorderThreshold: Prisma.Decimal | null;
  lastUnitPricePaise: bigint | null;
};

function itemToDTO(i: ItemRow) {
  return {
    id: i.id,
    name: i.name,
    unit: i.unit,
    stockQty: i.stockQty.toString(),
    reorderThreshold: i.reorderThreshold === null ? null : i.reorderThreshold.toString(),
    lastUnitPricePaise: i.lastUnitPricePaise === null ? null : i.lastUnitPricePaise.toString(),
  };
}

const ITEM_SELECT = {
  id: true,
  name: true,
  unit: true,
  stockQty: true,
  reorderThreshold: true,
  lastUnitPricePaise: true,
} satisfies Prisma.FeedItemSelect;

export async function createFeedItem(farmId: string, userId: string, input: CreateFeedItemInput) {
  try {
    const item = await prisma.feedItem.create({
      data: {
        farmId,
        name: input.name,
        unit: input.unit ?? 'kg',
        reorderThreshold: input.reorderThreshold,
        createdBy: userId,
      },
      select: ITEM_SELECT,
    });
    return itemToDTO(item);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'FEED_NAME_TAKEN', 'A feed item with this name already exists');
    }
    throw err;
  }
}

export async function listFeedItems(farmId: string) {
  const items = await prisma.feedItem.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: ITEM_SELECT,
  });
  return items.map(itemToDTO);
}

export async function recordPurchase(farmId: string, userId: string, input: PurchaseInput) {
  const item = await prisma.feedItem.findFirst({ where: { id: input.feedItemId, farmId, deletedAt: null } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Feed item not found');

  const unitPricePaise = BigInt(input.unitPricePaise);
  const totalPaise = BigInt(purchaseTotalPaise(input.qty, Number(unitPricePaise)));

  const [, updated] = await prisma.$transaction([
    prisma.feedTransaction.create({
      data: {
        farmId,
        feedItemId: item.id,
        type: 'PURCHASE',
        qty: new Prisma.Decimal(input.qty),
        unitPricePaise,
        totalPaise,
        vendorId: input.vendorId,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        createdBy: userId,
      },
    }),
    prisma.feedItem.update({
      where: { id: item.id },
      data: { stockQty: { increment: new Prisma.Decimal(input.qty) }, lastUnitPricePaise: unitPricePaise, updatedBy: userId },
      select: ITEM_SELECT,
    }),
  ]);

  return { item: itemToDTO(updated), totalPaise: totalPaise.toString() };
}

export async function recordConsumption(farmId: string, userId: string, input: ConsumeInput) {
  const item = await prisma.feedItem.findFirst({ where: { id: input.feedItemId, farmId, deletedAt: null } });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Feed item not found');
  const batch = await prisma.batch.findFirst({ where: { id: input.batchId, farmId, deletedAt: null } });
  if (!batch) throw new AppError(422, 'INVALID_TARGET', 'Batch does not belong to this farm');
  if (item.stockQty.lessThan(new Prisma.Decimal(input.qty))) {
    throw new AppError(422, 'INSUFFICIENT_STOCK', `Only ${item.stockQty.toString()} ${item.unit} in stock`);
  }
  const totalPaise = item.lastUnitPricePaise
    ? BigInt(purchaseTotalPaise(input.qty, Number(item.lastUnitPricePaise)))
    : null;

  const [, updated] = await prisma.$transaction([
    prisma.feedTransaction.create({
      data: {
        farmId,
        feedItemId: item.id,
        type: 'CONSUMPTION',
        qty: new Prisma.Decimal(input.qty),
        unitPricePaise: item.lastUnitPricePaise,
        totalPaise,
        batchId: input.batchId,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        createdBy: userId,
      },
    }),
    prisma.feedItem.update({
      where: { id: item.id },
      data: { stockQty: { decrement: new Prisma.Decimal(input.qty) }, updatedBy: userId },
      select: ITEM_SELECT,
    }),
  ]);
  return { item: itemToDTO(updated), costPaise: totalPaise === null ? null : totalPaise.toString() };
}

export async function batchFcr(farmId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({ where: { id: batchId, farmId, deletedAt: null } });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

  const consumption = await prisma.feedTransaction.findMany({
    where: { farmId, batchId, type: 'CONSUMPTION' },
    select: { qty: true, totalPaise: true },
  });
  const feedConsumedKg = consumption.reduce((s, c) => s + Number(c.qty), 0);
  const feedCostPaise = consumption.reduce((s, c) => s + (c.totalPaise ?? 0n), 0n);

  const weights = await prisma.dailyLog.findMany({
    where: { farmId, batchId, type: 'WEIGHT' },
    orderBy: { loggedAt: 'asc' },
    select: { quantity: true },
  });
  const gainKg = weights.length >= 2 ? weights[weights.length - 1]!.quantity - weights[0]!.quantity : 0;

  return {
    feedConsumedKg,
    weightGainKg: gainKg,
    feedCostPaise: feedCostPaise.toString(),
    fcr: fcr(feedConsumedKg, gainKg),
  };
}

export async function lowStock(farmId: string) {
  const items = await prisma.feedItem.findMany({
    where: { farmId, deletedAt: null, reorderThreshold: { not: null } },
    select: ITEM_SELECT,
  });
  return items.filter((i) => i.reorderThreshold !== null && i.stockQty.lessThan(i.reorderThreshold)).map(itemToDTO);
}
