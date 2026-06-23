import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { dayBounds, generateDueTasks, sweepMissed } from './engine';
import type { CreateScheduleInput, CreateTaskInput } from './schemas';

const TASK_SELECT = {
  id: true,
  title: true,
  taskType: true,
  unitId: true,
  dueDate: true,
  status: true,
  assignedWorkerId: true,
  completedAt: true,
  templateId: true,
} satisfies Prisma.TaskSelect;

export async function createSchedule(farmId: string, userId: string, input: CreateScheduleInput) {
  return prisma.scheduleTemplate.create({
    data: { farmId, ...input, createdBy: userId },
    select: { id: true, name: true, taskType: true, frequency: true, isActive: true, unitId: true },
  });
}

export async function listSchedules(farmId: string) {
  return prisma.scheduleTemplate.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, taskType: true, frequency: true, isActive: true, unitId: true },
  });
}

export async function listTasks(farmId: string, filter: { date?: string; status?: string }) {
  const where: Prisma.TaskWhereInput = { farmId };
  if (filter.date) where.dueDate = dayBounds(new Date(`${filter.date}T00:00:00.000Z`));
  if (filter.status) where.status = filter.status as Prisma.EnumTaskStatusFilter['equals'];
  return prisma.task.findMany({ where, orderBy: { dueDate: 'desc' }, select: TASK_SELECT });
}

export async function createTask(farmId: string, userId: string, input: CreateTaskInput) {
  return prisma.task.create({
    data: {
      farmId,
      title: input.title,
      taskType: input.taskType,
      unitId: input.unitId,
      assignedWorkerId: input.assignedWorkerId,
      dueDate: dayBounds(new Date(`${input.dueDate}T00:00:00.000Z`)),
      createdBy: userId,
    },
    select: TASK_SELECT,
  });
}

export async function completeTask(farmId: string, id: string, userId: string, notes?: string) {
  const task = await prisma.task.findFirst({ where: { id, farmId } });
  if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found');
  return prisma.task.update({
    where: { id },
    data: { status: 'DONE', completedAt: new Date(), completedBy: userId, notes, updatedBy: userId },
    select: TASK_SELECT,
  });
}

export async function generate(farmId: string, dateStr?: string) {
  const date = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  const created = await generateDueTasks(farmId, date);
  const missed = await sweepMissed(farmId, new Date());
  return { generated: created, missed };
}
