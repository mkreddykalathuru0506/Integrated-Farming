import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import type { CreateSpeciesInput } from './schemas';

export async function listSpecies(farmId: string) {
  return prisma.species.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true, trackingMode: true, isSystemDefault: true },
  });
}

export async function getSpecies(farmId: string, id: string) {
  const s = await prisma.species.findFirst({
    where: { id, farmId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      trackingMode: true,
      isSystemDefault: true,
      breeds: {
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, isSystemDefault: true },
      },
      stages: {
        where: { deletedAt: null },
        orderBy: { sequence: 'asc' },
        select: { id: true, name: true, sequence: true, isTerminal: true },
      },
    },
  });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Species not found');
  return s;
}

export async function createSpecies(farmId: string, userId: string, input: CreateSpeciesInput) {
  try {
    return await prisma.species.create({
      data: {
        farmId,
        code: input.code.toUpperCase(),
        name: input.name,
        trackingMode: input.trackingMode,
        createdBy: userId,
      },
      select: { id: true, code: true, name: true, trackingMode: true, isSystemDefault: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'SPECIES_CODE_TAKEN', 'A species with this code already exists');
    }
    throw err;
  }
}

export async function createBreed(farmId: string, speciesId: string, name: string) {
  const species = await prisma.species.findFirst({ where: { id: speciesId, farmId, deletedAt: null } });
  if (!species) throw new AppError(404, 'NOT_FOUND', 'Species not found');
  try {
    return await prisma.breed.create({
      data: { farmId, speciesId, name },
      select: { id: true, name: true, isSystemDefault: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'BREED_NAME_TAKEN', 'A breed with this name already exists');
    }
    throw err;
  }
}
