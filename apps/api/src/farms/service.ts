import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { seedFarmReference } from '../livestock/reference';
import type {
  CreateFarmInput,
  CreateUnitInput,
  UpdateSettingsInput,
  UpdateUnitInput,
} from './schemas';

type FarmRow = { id: string; name: string; state: string | null; district: string | null };
type SettingRow = {
  timezone: string;
  currency: string;
  defaultLocale: string;
  areaUnit: string;
  fssaiLicenseNo: string | null;
  fssaiTier: string | null;
  gstin: string | null;
  gstThresholdPaise: bigint | null;
  latitude: number | null;
  longitude: number | null;
};
type UnitRow = {
  id: string;
  name: string;
  type: string;
  code: string | null;
  isActive: boolean;
  createdAt: Date;
};

const FARM_SELECT = { id: true, name: true, state: true, district: true } as const;
const UNIT_SELECT = {
  id: true,
  name: true,
  type: true,
  code: true,
  isActive: true,
  createdAt: true,
} as const;

function settingToDTO(s: SettingRow) {
  return {
    timezone: s.timezone,
    currency: s.currency,
    defaultLocale: s.defaultLocale,
    areaUnit: s.areaUnit,
    fssaiLicenseNo: s.fssaiLicenseNo,
    fssaiTier: s.fssaiTier,
    gstin: s.gstin,
    // money: integer paise transported as a string (avoids BigInt JSON + precision issues)
    gstThresholdPaise: s.gstThresholdPaise === null ? null : s.gstThresholdPaise.toString(),
    latitude: s.latitude,
    longitude: s.longitude,
  };
}

const unitToDTO = (u: UnitRow) => u; // already plain; Date serializes to ISO via res.json

export async function createFarm(userId: string, input: CreateFarmInput): Promise<FarmRow> {
  const farm = await prisma.farm.create({
    data: {
      name: input.name,
      state: input.state,
      district: input.district,
      createdBy: userId,
      settings: { create: {} },
      memberships: { create: { userId, role: 'OWNER' } },
    },
    select: FARM_SELECT,
  });
  // New farms get the system-default livestock reference catalogue.
  await seedFarmReference(prisma, farm.id);
  return farm;
}

export async function getFarm(farmId: string) {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { ...FARM_SELECT, settings: true },
  });
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Farm not found');
  const { settings, ...rest } = farm;
  return { ...rest, settings: settings ? settingToDTO(settings) : null };
}

export async function updateFarm(
  farmId: string,
  userId: string,
  input: { name?: string; state?: string | null; district?: string | null },
) {
  return prisma.farm.update({
    where: { id: farmId },
    data: { ...input, updatedBy: userId },
    select: FARM_SELECT,
  });
}

export async function getSettings(farmId: string) {
  const s = await prisma.farmSetting.findUnique({ where: { farmId } });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Settings not found');
  return settingToDTO(s);
}

export async function updateSettings(farmId: string, input: UpdateSettingsInput) {
  const data: Prisma.FarmSettingUpdateInput = {};
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.defaultLocale !== undefined) data.defaultLocale = input.defaultLocale;
  if (input.areaUnit !== undefined) data.areaUnit = input.areaUnit;
  if (input.fssaiLicenseNo !== undefined) data.fssaiLicenseNo = input.fssaiLicenseNo;
  if (input.fssaiTier !== undefined) data.fssaiTier = input.fssaiTier;
  if (input.gstin !== undefined) data.gstin = input.gstin;
  if (input.gstThresholdPaise !== undefined) {
    data.gstThresholdPaise =
      input.gstThresholdPaise === null ? null : BigInt(input.gstThresholdPaise);
  }
  if (input.latitude !== undefined) data.latitude = input.latitude;
  if (input.longitude !== undefined) data.longitude = input.longitude;
  const s = await prisma.farmSetting.update({ where: { farmId }, data });
  return settingToDTO(s);
}

export async function listUnits(farmId: string) {
  const units = await prisma.unit.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: UNIT_SELECT,
  });
  return units.map(unitToDTO);
}

export async function createUnit(farmId: string, userId: string, input: CreateUnitInput) {
  try {
    return await prisma.unit.create({
      data: {
        farmId,
        name: input.name,
        type: input.type,
        code: input.code ?? undefined,
        createdBy: userId,
      },
      select: UNIT_SELECT,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'UNIT_NAME_TAKEN', 'A unit with this name already exists');
    }
    throw err;
  }
}

async function findUnitInFarm(farmId: string, id: string) {
  const unit = await prisma.unit.findFirst({ where: { id, farmId, deletedAt: null } });
  if (!unit) throw new AppError(404, 'NOT_FOUND', 'Unit not found');
  return unit;
}

export async function updateUnit(
  farmId: string,
  id: string,
  userId: string,
  input: UpdateUnitInput,
) {
  await findUnitInFarm(farmId, id); // farm-scoped existence check (no cross-farm leak)
  try {
    return await prisma.unit.update({
      where: { id },
      data: { ...input, code: input.code ?? undefined, updatedBy: userId },
      select: UNIT_SELECT,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'UNIT_NAME_TAKEN', 'A unit with this name already exists');
    }
    throw err;
  }
}

export async function softDeleteUnit(farmId: string, id: string, userId: string) {
  await findUnitInFarm(farmId, id);
  await prisma.unit.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: userId } });
}

/**
 * New-farm onboarding progress (slice 11.7, read-only): cheap `count()`s over the five
 * setup milestones the dashboard checklist walks a new owner through.
 */
export async function onboarding(farmId: string) {
  const [units, batches, workers, dailyLogs, invoices] = await Promise.all([
    prisma.unit.count({ where: { farmId, deletedAt: null } }),
    prisma.batch.count({ where: { farmId, deletedAt: null } }),
    prisma.worker.count({ where: { farmId, deletedAt: null } }),
    prisma.dailyLog.count({ where: { farmId } }),
    prisma.invoice.count({ where: { farmId } }),
  ]);
  const steps = {
    units: { done: units > 0 },
    batches: { done: batches > 0 },
    workers: { done: workers > 0 },
    dailyLogs: { done: dailyLogs > 0 },
    invoices: { done: invoices > 0 },
  };
  const completedCount = Object.values(steps).filter((s) => s.done).length;
  return { steps, completedCount, total: Object.keys(steps).length };
}
