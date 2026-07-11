import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import type { CreateWorkerInput, MarkAttendanceInput, UpdateWorkerInput } from './schemas';

type WorkerRow = {
  id: string;
  name: string;
  phone: string | null;
  designation: string | null;
  wageType: string;
  dailyWageRatePaise: bigint | null;
  isActive: boolean;
  userId: string | null;
};

function workerToDTO(w: WorkerRow) {
  return {
    id: w.id,
    name: w.name,
    phone: w.phone,
    designation: w.designation,
    wageType: w.wageType,
    dailyWageRatePaise: w.dailyWageRatePaise === null ? null : w.dailyWageRatePaise.toString(),
    isActive: w.isActive,
    userId: w.userId,
  };
}

const WORKER_SELECT = {
  id: true,
  name: true,
  phone: true,
  designation: true,
  wageType: true,
  dailyWageRatePaise: true,
  isActive: true,
  userId: true,
} satisfies Prisma.WorkerSelect;

function toPaise(v: number | string | null | undefined): bigint | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return BigInt(v);
}

export async function createWorker(farmId: string, userId: string, input: CreateWorkerInput) {
  const w = await prisma.worker.create({
    data: {
      farmId,
      name: input.name,
      phone: input.phone,
      designation: input.designation,
      wageType: input.wageType,
      dailyWageRatePaise: toPaise(input.dailyWageRatePaise) ?? undefined,
      userId: input.userId,
      createdBy: userId,
    },
    select: WORKER_SELECT,
  });
  return workerToDTO(w);
}

export type WorkerListFilter = { q?: string; active?: boolean; from?: Date; to?: Date };

function workerWhere(farmId: string, f: WorkerListFilter): Prisma.WorkerWhereInput {
  const where: Prisma.WorkerWhereInput = { farmId, deletedAt: null };
  if (f.q) where.OR = [{ name: contains(f.q) }, { phone: contains(f.q) }];
  if (f.active !== undefined) where.isActive = f.active;
  const range = dateRange(f.from, f.to);
  if (range) where.createdAt = range;
  return where;
}

export async function listWorkers(farmId: string, filter: WorkerListFilter = {}) {
  const rows = await prisma.worker.findMany({
    where: workerWhere(farmId, filter),
    orderBy: { name: 'asc' },
    select: WORKER_SELECT,
  });
  return rows.map(workerToDTO);
}

export async function listWorkersPaged(farmId: string, p: ListQuery & WorkerListFilter) {
  const where = workerWhere(farmId, p);
  const [rows, total] = await Promise.all([
    prisma.worker.findMany({ where, orderBy: { name: 'asc' }, ...skipTake(p), select: WORKER_SELECT }),
    prisma.worker.count({ where }),
  ]);
  return envelope(rows.map(workerToDTO), total, p);
}

async function findWorkerInFarm(farmId: string, id: string) {
  const w = await prisma.worker.findFirst({ where: { id, farmId, deletedAt: null } });
  if (!w) throw new AppError(404, 'NOT_FOUND', 'Worker not found');
  return w;
}

export async function getWorker(farmId: string, id: string) {
  await findWorkerInFarm(farmId, id);
  const w = await prisma.worker.findUnique({ where: { id }, select: WORKER_SELECT });
  return workerToDTO(w!);
}

export async function updateWorker(farmId: string, id: string, userId: string, input: UpdateWorkerInput) {
  await findWorkerInFarm(farmId, id);
  const data: Prisma.WorkerUpdateInput = {
    name: input.name,
    phone: input.phone,
    designation: input.designation,
    wageType: input.wageType,
    isActive: input.isActive,
    updatedBy: userId,
  };
  const wage = toPaise(input.dailyWageRatePaise);
  if (wage !== undefined) data.dailyWageRatePaise = wage;
  const w = await prisma.worker.update({ where: { id }, data, select: WORKER_SELECT });
  return workerToDTO(w);
}

function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export async function markAttendance(farmId: string, userId: string, input: MarkAttendanceInput) {
  await findWorkerInFarm(farmId, input.workerId);
  const date = parseDay(input.date);
  return prisma.attendance.upsert({
    where: { workerId_date: { workerId: input.workerId, date } },
    update: { status: input.status, notes: input.notes, recordedBy: userId },
    create: { farmId, workerId: input.workerId, date, status: input.status, notes: input.notes, recordedBy: userId },
    select: { id: true, workerId: true, date: true, status: true, notes: true },
  });
}

export async function listAttendance(farmId: string, date: string) {
  return prisma.attendance.findMany({
    where: { farmId, date: parseDay(date) },
    select: { id: true, workerId: true, date: true, status: true, notes: true },
  });
}
