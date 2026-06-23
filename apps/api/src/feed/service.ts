import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { purchaseTotalPaise } from './calc';
import type { CreateFeedItemInput, PurchaseInput } from './schemas';

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

export async function lowStock(farmId: string) {
  const items = await prisma.feedItem.findMany({
    where: { farmId, deletedAt: null, reorderThreshold: { not: null } },
    select: ITEM_SELECT,
  });
  return items.filter((i) => i.reorderThreshold !== null && i.stockQty.lessThan(i.reorderThreshold)).map(itemToDTO);
}
