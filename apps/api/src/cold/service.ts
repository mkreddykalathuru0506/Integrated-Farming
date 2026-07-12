import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { dateRange, envelope, skipTake } from '../http/list-query';
import { defaultBand, isOutOfRange } from './calc';
import type { CreateColdStorageInput, RecordTempInput } from './schemas';

export async function createColdStorage(farmId: string, userId: string, input: CreateColdStorageInput) {
  const mode = input.mode ?? 'FROZEN';
  const band = defaultBand(mode);
  const minTempC = input.minTempC ?? band.minTempC;
  const maxTempC = input.maxTempC ?? band.maxTempC;
  if (minTempC > maxTempC) throw new AppError(422, 'BAD_BAND', 'minTempC cannot exceed maxTempC');
  try {
    return await prisma.coldStorage.create({
      data: { farmId, name: input.name, mode, unitId: input.unitId, minTempC, maxTempC, createdBy: userId },
      select: { id: true, name: true, mode: true, minTempC: true, maxTempC: true, isActive: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'COLD_STORAGE_NAME_TAKEN', 'A cold storage with this name already exists');
    }
    throw err;
  }
}

/** List stores with their latest reading + out-of-range flag + recent breach count. */
export async function listColdStorages(farmId: string) {
  const stores = await prisma.coldStorage.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      mode: true,
      minTempC: true,
      maxTempC: true,
      isActive: true,
      temperatureLogs: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
        select: { temperatureC: true, isOutOfRange: true, recordedAt: true },
      },
      _count: { select: { temperatureLogs: { where: { isOutOfRange: true } } } },
    },
  });
  return stores.map((s) => ({
    id: s.id,
    name: s.name,
    mode: s.mode,
    minTempC: s.minTempC,
    maxTempC: s.maxTempC,
    isActive: s.isActive,
    latest: s.temperatureLogs[0] ?? null,
    breachCount: s._count.temperatureLogs,
  }));
}

async function findStore(farmId: string, id: string) {
  const store = await prisma.coldStorage.findFirst({ where: { id, farmId, deletedAt: null } });
  if (!store) throw new AppError(404, 'NOT_FOUND', 'Cold storage not found');
  return store;
}

export async function recordTemp(farmId: string, coldStorageId: string, userId: string, input: RecordTempInput) {
  const store = await findStore(farmId, coldStorageId);
  const outOfRange = isOutOfRange(input.temperatureC, store.minTempC, store.maxTempC);
  return prisma.temperatureLog.create({
    data: {
      farmId,
      coldStorageId,
      temperatureC: input.temperatureC,
      isOutOfRange: outOfRange,
      source: input.source ?? 'manual',
      notes: input.notes,
      recordedBy: userId,
    },
    select: { id: true, temperatureC: true, isOutOfRange: true, recordedAt: true, source: true },
  });
}

const TEMP_SELECT = {
  id: true,
  temperatureC: true,
  isOutOfRange: true,
  recordedAt: true,
  source: true,
  notes: true,
} satisfies Prisma.TemperatureLogSelect;

export type TempListFilter = { from?: Date; to?: Date };

function tempWhere(farmId: string, coldStorageId: string, f: TempListFilter): Prisma.TemperatureLogWhereInput {
  const where: Prisma.TemperatureLogWhereInput = { farmId, coldStorageId };
  const range = dateRange(f.from, f.to);
  if (range) where.recordedAt = range;
  return where;
}

/**
 * Temperature history. No params → legacy behaviour (last 50, newest first).
 * With from/to → bounded window (asc when `from` is given — chart-ready), cap 1000.
 */
export async function listTemps(farmId: string, coldStorageId: string, filter: TempListFilter = {}) {
  await findStore(farmId, coldStorageId);
  const windowed = Boolean(filter.from || filter.to);
  return prisma.temperatureLog.findMany({
    where: tempWhere(farmId, coldStorageId, filter),
    orderBy: { recordedAt: filter.from ? 'asc' : 'desc' },
    take: windowed ? 1000 : 50,
    select: TEMP_SELECT,
  });
}

export async function listTempsPaged(
  farmId: string,
  coldStorageId: string,
  p: { from?: Date; to?: Date; page?: number; pageSize: number },
) {
  await findStore(farmId, coldStorageId);
  const where = tempWhere(farmId, coldStorageId, p);
  const [items, total] = await Promise.all([
    prisma.temperatureLog.findMany({ where, orderBy: { recordedAt: 'desc' }, ...skipTake(p), select: TEMP_SELECT }),
    prisma.temperatureLog.count({ where }),
  ]);
  return envelope(items, total, p);
}

/** Out-of-range readings across the farm — the alert surface. */
export async function listAlerts(farmId: string) {
  const rows = await prisma.temperatureLog.findMany({
    where: { farmId, isOutOfRange: true },
    orderBy: { recordedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      temperatureC: true,
      recordedAt: true,
      coldStorage: { select: { id: true, name: true, mode: true, minTempC: true, maxTempC: true } },
    },
  });
  return rows;
}
