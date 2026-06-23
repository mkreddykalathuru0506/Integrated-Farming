import { prisma } from '../prisma';
import { AppError } from '../errors';
import { addDays } from './dates';
import type { CreateBreedingInput, UpdateBreedingInput } from './schemas';

const SELECT = {
  id: true,
  speciesId: true,
  damId: true,
  sireId: true,
  method: true,
  breedingDate: true,
  expectedDueDate: true,
  status: true,
  offspringCount: true,
} as const;

async function animalInFarm(farmId: string, id: string) {
  const a = await prisma.animal.findFirst({ where: { id, farmId, deletedAt: null } });
  if (!a) throw new AppError(422, 'INVALID_TARGET', 'Animal does not belong to this farm');
  return a;
}

export async function createBreeding(farmId: string, userId: string, input: CreateBreedingInput) {
  const dam = input.damId ? await animalInFarm(farmId, input.damId) : null;
  if (input.sireId) await animalInFarm(farmId, input.sireId);

  const speciesId = input.speciesId ?? dam?.speciesId;
  let gestationDays: number | null = null;
  if (speciesId) {
    const species = await prisma.species.findFirst({ where: { id: speciesId, farmId, deletedAt: null } });
    if (!species) throw new AppError(422, 'INVALID_TARGET', 'Species does not belong to this farm');
    gestationDays = species.gestationDays;
  }

  const breedingDate = new Date(input.breedingDate);
  const expectedDueDate = input.expectedDueDate
    ? new Date(input.expectedDueDate)
    : gestationDays
      ? addDays(breedingDate, gestationDays)
      : null;

  return prisma.breedingRecord.create({
    data: {
      farmId,
      speciesId,
      damId: input.damId,
      sireId: input.sireId,
      method: input.method,
      breedingDate,
      expectedDueDate,
      notes: input.notes,
      createdBy: userId,
    },
    select: SELECT,
  });
}

export async function listBreeding(farmId: string) {
  return prisma.breedingRecord.findMany({ where: { farmId }, orderBy: { breedingDate: 'desc' }, select: SELECT });
}

export async function updateBreeding(farmId: string, id: string, userId: string, input: UpdateBreedingInput) {
  const rec = await prisma.breedingRecord.findFirst({ where: { id, farmId } });
  if (!rec) throw new AppError(404, 'NOT_FOUND', 'Breeding record not found');
  return prisma.breedingRecord.update({
    where: { id },
    data: {
      status: input.status,
      offspringCount: input.offspringCount,
      expectedDueDate:
        input.expectedDueDate === undefined
          ? undefined
          : input.expectedDueDate === null
            ? null
            : new Date(input.expectedDueDate),
      notes: input.notes,
      updatedBy: userId,
    },
    select: SELECT,
  });
}
