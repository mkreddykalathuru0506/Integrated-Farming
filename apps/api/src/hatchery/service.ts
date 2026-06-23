import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { addDays } from '../breeding/dates';
import { rate } from './rates';
import type { AddIncubationLogInput, CreateHatcheryInput, UpdateHatcheryInput } from './schemas';

const SELECT = {
  id: true,
  code: true,
  speciesId: true,
  breedId: true,
  setDate: true,
  eggCount: true,
  incubationDays: true,
  expectedHatchDate: true,
  candlingDate: true,
  lockdownDate: true,
  status: true,
  fertileCount: true,
  hatchedCount: true,
} satisfies Prisma.HatcheryBatchSelect;

function withRates<T extends { eggCount: number; hatchedCount: number | null; fertileCount: number | null }>(b: T) {
  return { ...b, hatchRate: rate(b.eggCount, b.hatchedCount), fertilityRate: rate(b.eggCount, b.fertileCount) };
}

export async function createHatchery(farmId: string, userId: string, input: CreateHatcheryInput) {
  const species = await prisma.species.findFirst({ where: { id: input.speciesId, farmId, deletedAt: null } });
  if (!species) throw new AppError(404, 'NOT_FOUND', 'Species not found');
  const incubationDays = input.incubationDays ?? species.incubationDays;
  if (!incubationDays) {
    throw new AppError(422, 'NO_INCUBATION_DAYS', 'This species has no incubation period; provide incubationDays');
  }
  if (input.breedId) {
    const breed = await prisma.breed.findFirst({ where: { id: input.breedId, farmId, speciesId: species.id, deletedAt: null } });
    if (!breed) throw new AppError(422, 'INVALID_BREED', 'Breed does not belong to this species');
  }
  const setDate = new Date(input.setDate);
  try {
    const created = await prisma.hatcheryBatch.create({
      data: {
        farmId,
        speciesId: species.id,
        breedId: input.breedId,
        code: input.code,
        setDate,
        eggCount: input.eggCount,
        incubationDays,
        expectedHatchDate: addDays(setDate, incubationDays),
        candlingDate: addDays(setDate, 7),
        lockdownDate: incubationDays > 3 ? addDays(setDate, incubationDays - 3) : null,
        createdBy: userId,
      },
      select: SELECT,
    });
    return withRates(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'HATCHERY_CODE_TAKEN', 'A hatchery batch with this code already exists');
    }
    throw err;
  }
}

export async function listHatchery(farmId: string) {
  const rows = await prisma.hatcheryBatch.findMany({ where: { farmId }, orderBy: { setDate: 'desc' }, select: SELECT });
  return rows.map(withRates);
}

async function findInFarm(farmId: string, id: string) {
  const b = await prisma.hatcheryBatch.findFirst({ where: { id, farmId } });
  if (!b) throw new AppError(404, 'NOT_FOUND', 'Hatchery batch not found');
  return b;
}

export async function getHatchery(farmId: string, id: string) {
  await findInFarm(farmId, id);
  const b = await prisma.hatcheryBatch.findUnique({
    where: { id },
    select: {
      ...SELECT,
      incubationLogs: {
        orderBy: { occurredAt: 'desc' },
        select: { id: true, event: true, occurredAt: true, temperatureC: true, humidityPct: true, notes: true },
      },
    },
  });
  return withRates(b!);
}

export async function updateHatchery(farmId: string, id: string, userId: string, input: UpdateHatcheryInput) {
  await findInFarm(farmId, id);
  const b = await prisma.hatcheryBatch.update({
    where: { id },
    data: { status: input.status, fertileCount: input.fertileCount, hatchedCount: input.hatchedCount, updatedBy: userId },
    select: SELECT,
  });
  return withRates(b);
}

export async function addIncubationLog(farmId: string, id: string, userId: string, input: AddIncubationLogInput) {
  await findInFarm(farmId, id);
  return prisma.incubationLog.create({
    data: {
      farmId,
      hatcheryBatchId: id,
      event: input.event,
      temperatureC: input.temperatureC,
      humidityPct: input.humidityPct,
      notes: input.notes,
      createdBy: userId,
    },
    select: { id: true, event: true, occurredAt: true, temperatureC: true, humidityPct: true },
  });
}
