import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
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

export async function listTemps(farmId: string, coldStorageId: string) {
  await findStore(farmId, coldStorageId);
  return prisma.temperatureLog.findMany({
    where: { farmId, coldStorageId },
    orderBy: { recordedAt: 'desc' },
    take: 50,
    select: { id: true, temperatureC: true, isOutOfRange: true, recordedAt: true, source: true, notes: true },
  });
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
