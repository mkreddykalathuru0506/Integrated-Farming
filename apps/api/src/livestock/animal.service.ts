import { Prisma, type AnimalStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import { firstStage } from './stage-machine';
import type { CreateAnimalInput, UpdateAnimalInput } from './schemas';

const SELECT = {
  id: true,
  tagNumber: true,
  qrCode: true,
  name: true,
  sex: true,
  dob: true,
  status: true,
  species: { select: { id: true, code: true, name: true } },
  breed: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  currentStage: { select: { id: true, name: true, sequence: true, isTerminal: true } },
} satisfies Prisma.AnimalSelect;

export async function createAnimal(farmId: string, userId: string, input: CreateAnimalInput) {
  const species = await prisma.species.findFirst({
    where: { id: input.speciesId, farmId, deletedAt: null },
  });
  if (!species) throw new AppError(404, 'NOT_FOUND', 'Species not found');
  if (species.trackingMode !== 'INDIVIDUAL') {
    throw new AppError(422, 'SPECIES_NOT_INDIVIDUAL', 'This species is tracked as batches, not individuals');
  }
  if (input.breedId) {
    const breed = await prisma.breed.findFirst({
      where: { id: input.breedId, farmId, speciesId: species.id, deletedAt: null },
    });
    if (!breed) throw new AppError(422, 'INVALID_BREED', 'Breed does not belong to this species');
  }
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, farmId, deletedAt: null } });
    if (!unit) throw new AppError(422, 'INVALID_UNIT', 'Unit does not belong to this farm');
  }

  const stages = await prisma.lifecycleStage.findMany({
    where: { farmId, speciesId: species.id, deletedAt: null },
    select: { id: true, sequence: true, isTerminal: true },
  });
  const start = firstStage(stages);

  try {
    const animal = await prisma.animal.create({
      data: {
        farmId,
        speciesId: species.id,
        breedId: input.breedId,
        unitId: input.unitId,
        tagNumber: input.tagNumber,
        name: input.name,
        sex: input.sex,
        dob: input.dob ? new Date(input.dob) : undefined,
        currentStageId: start?.id,
        createdBy: userId,
      },
    });
    return prisma.animal.update({
      where: { id: animal.id },
      data: { qrCode: `IFM-A-${animal.id}` },
      select: SELECT,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'ANIMAL_TAG_TAKEN', 'An animal with this tag number already exists');
    }
    throw err;
  }
}

export type AnimalListFilter = { q?: string; status?: AnimalStatus; from?: Date; to?: Date };

/** Shared where-builder so the legacy list and the paged list can't drift. */
function animalWhere(farmId: string, f: AnimalListFilter): Prisma.AnimalWhereInput {
  const where: Prisma.AnimalWhereInput = { farmId, deletedAt: null };
  if (f.q) where.OR = [{ tagNumber: contains(f.q) }, { name: contains(f.q) }];
  if (f.status) where.status = f.status;
  const range = dateRange(f.from, f.to);
  if (range) where.createdAt = range;
  return where;
}

export async function listAnimals(farmId: string, filter: AnimalListFilter = {}) {
  return prisma.animal.findMany({
    where: animalWhere(farmId, filter),
    orderBy: { createdAt: 'desc' },
    select: SELECT,
  });
}

export async function listAnimalsPaged(farmId: string, p: ListQuery & AnimalListFilter) {
  const where = animalWhere(farmId, p);
  const [items, total] = await Promise.all([
    prisma.animal.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(p), select: SELECT }),
    prisma.animal.count({ where }),
  ]);
  return envelope(items, total, p);
}

async function findAnimalInFarm(farmId: string, id: string) {
  const animal = await prisma.animal.findFirst({ where: { id, farmId, deletedAt: null } });
  if (!animal) throw new AppError(404, 'NOT_FOUND', 'Animal not found');
  return animal;
}

export async function getAnimal(farmId: string, id: string) {
  await findAnimalInFarm(farmId, id);
  return prisma.animal.findUnique({ where: { id }, select: SELECT });
}

export async function updateAnimal(farmId: string, id: string, userId: string, input: UpdateAnimalInput) {
  await findAnimalInFarm(farmId, id);
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, farmId, deletedAt: null } });
    if (!unit) throw new AppError(422, 'INVALID_UNIT', 'Unit does not belong to this farm');
  }
  try {
    return await prisma.animal.update({
      where: { id },
      data: {
        name: input.name,
        unitId: input.unitId,
        tagNumber: input.tagNumber,
        sex: input.sex,
        dob: input.dob === undefined ? undefined : input.dob === null ? null : new Date(input.dob),
        updatedBy: userId,
      },
      select: SELECT,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'ANIMAL_TAG_TAKEN', 'An animal with this tag number already exists');
    }
    throw err;
  }
}
