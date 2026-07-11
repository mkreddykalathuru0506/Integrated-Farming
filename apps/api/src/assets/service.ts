import { Prisma, type AssetStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { dueWithin } from '../finance/calc';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import type { CreateAssetInput, CreateScheduleInput, RecordMaintenanceInput } from './schemas';

const ASSET_SELECT = {
  id: true,
  name: true,
  type: true,
  code: true,
  status: true,
  purchaseDate: true,
  purchaseCostPaise: true,
  maintenanceSchedules: {
    where: { deletedAt: null },
    select: { id: true, name: true, intervalDays: true, nextDueDate: true, isActive: true },
    orderBy: { nextDueDate: 'asc' },
  },
} satisfies Prisma.AssetSelect;

type AssetRow = Prisma.AssetGetPayload<{ select: typeof ASSET_SELECT }>;

function assetDTO(a: AssetRow) {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    code: a.code,
    status: a.status,
    purchaseDate: a.purchaseDate,
    purchaseCostPaise: a.purchaseCostPaise ? a.purchaseCostPaise.toString() : null,
    schedules: a.maintenanceSchedules,
  };
}

export async function createAsset(farmId: string, userId: string, input: CreateAssetInput) {
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, farmId, deletedAt: null } });
    if (!unit) throw new AppError(422, 'INVALID_UNIT', 'Unit does not belong to this farm');
  }
  const asset = await prisma.asset.create({
    data: {
      farmId,
      name: input.name,
      type: input.type ?? 'EQUIPMENT',
      code: input.code,
      unitId: input.unitId,
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
      purchaseCostPaise: input.purchaseCostPaise !== undefined ? BigInt(input.purchaseCostPaise) : undefined,
      createdBy: userId,
    },
    select: ASSET_SELECT,
  });
  return assetDTO(asset);
}

export type AssetListFilter = { q?: string; status?: AssetStatus; from?: Date; to?: Date };

function assetWhere(farmId: string, f: AssetListFilter): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = { farmId, deletedAt: null };
  if (f.q) where.OR = [{ name: contains(f.q) }, { code: contains(f.q) }];
  if (f.status) where.status = f.status;
  const range = dateRange(f.from, f.to);
  if (range) where.createdAt = range;
  return where;
}

export async function listAssets(farmId: string, filter: AssetListFilter = {}) {
  const rows = await prisma.asset.findMany({
    where: assetWhere(farmId, filter),
    orderBy: { createdAt: 'desc' },
    select: ASSET_SELECT,
  });
  return rows.map(assetDTO);
}

export async function listAssetsPaged(farmId: string, p: ListQuery & AssetListFilter) {
  const where = assetWhere(farmId, p);
  const [rows, total] = await Promise.all([
    prisma.asset.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(p), select: ASSET_SELECT }),
    prisma.asset.count({ where }),
  ]);
  return envelope(rows.map(assetDTO), total, p);
}

async function findAsset(farmId: string, id: string) {
  const asset = await prisma.asset.findFirst({ where: { id, farmId, deletedAt: null }, select: { id: true } });
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found');
  return asset;
}

export async function createSchedule(farmId: string, assetId: string, userId: string, input: CreateScheduleInput) {
  await findAsset(farmId, assetId);
  return prisma.maintenanceSchedule.create({
    data: { farmId, assetId, name: input.name, intervalDays: input.intervalDays, nextDueDate: new Date(input.nextDueDate), createdBy: userId },
    select: { id: true, name: true, intervalDays: true, nextDueDate: true, isActive: true },
  });
}

/**
 * Record a service/repair. If tied to a schedule, advance its nextDueDate by intervalDays
 * (from the performed date) so the next service is auto-scheduled.
 */
export async function recordMaintenance(farmId: string, assetId: string, userId: string, input: RecordMaintenanceInput) {
  await findAsset(farmId, assetId);
  const performedAt = input.performedAt ? new Date(input.performedAt) : new Date();

  let schedule: { id: string; intervalDays: number } | null = null;
  if (input.scheduleId) {
    schedule = await prisma.maintenanceSchedule.findFirst({
      where: { id: input.scheduleId, assetId, farmId, deletedAt: null },
      select: { id: true, intervalDays: true },
    });
    if (!schedule) throw new AppError(422, 'INVALID_SCHEDULE', 'Schedule does not belong to this asset');
  }

  return prisma.$transaction(async (tx) => {
    const record = await tx.maintenanceRecord.create({
      data: {
        farmId,
        assetId,
        scheduleId: schedule?.id,
        type: input.type ?? 'SERVICE',
        performedAt,
        costPaise: input.costPaise !== undefined ? BigInt(input.costPaise) : 0n,
        vendor: input.vendor,
        notes: input.notes,
        createdBy: userId,
      },
      select: { id: true, type: true, performedAt: true, costPaise: true, vendor: true, scheduleId: true },
    });
    if (schedule) {
      const next = new Date(performedAt.getTime() + schedule.intervalDays * 86_400_000);
      await tx.maintenanceSchedule.update({ where: { id: schedule.id }, data: { nextDueDate: next, updatedBy: userId } });
    }
    return { id: record.id, type: record.type, performedAt: record.performedAt, costPaise: record.costPaise.toString(), vendor: record.vendor, scheduleId: record.scheduleId };
  });
}

export async function listMaintenance(farmId: string, assetId: string) {
  await findAsset(farmId, assetId);
  const rows = await prisma.maintenanceRecord.findMany({
    where: { farmId, assetId },
    orderBy: { performedAt: 'desc' },
    take: 50,
    select: { id: true, type: true, performedAt: true, costPaise: true, vendor: true, notes: true },
  });
  return rows.map((r) => ({ ...r, costPaise: r.costPaise.toString() }));
}

/** Schedules due or overdue within `days` (default 14) — the maintenance reminder feed. */
export async function reminders(farmId: string, days = 14) {
  const now = new Date();
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { farmId, isActive: true, deletedAt: null },
    select: { id: true, name: true, nextDueDate: true, asset: { select: { id: true, name: true } } },
    orderBy: { nextDueDate: 'asc' },
  });
  const due = schedules.filter((s) => dueWithin(s.nextDueDate, days, now));
  return { due };
}
