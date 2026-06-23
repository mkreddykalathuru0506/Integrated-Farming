import type { Frequency } from '@prisma/client';
import { prisma } from '../prisma';

/** Whether a template of the given frequency is due on the given (UTC) date. */
export function isDue(frequency: Frequency, date: Date): boolean {
  switch (frequency) {
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return date.getUTCDay() === 1; // Monday
    case 'MONTHLY':
      return date.getUTCDate() === 1;
    default:
      return false;
  }
}

/** Normalize a date to UTC midnight (used as the per-day key for tasks). */
export function dayBounds(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Idempotently create one task per due active template for the date. Returns # due templates. */
export async function generateDueTasks(farmId: string, onDate: Date): Promise<number> {
  const dueDate = dayBounds(onDate);
  const templates = await prisma.scheduleTemplate.findMany({
    where: { farmId, isActive: true, deletedAt: null },
  });
  let due = 0;
  for (const tpl of templates) {
    if (!isDue(tpl.frequency, dueDate)) continue;
    due++;
    await prisma.task.upsert({
      where: { templateId_dueDate: { templateId: tpl.id, dueDate } },
      update: {},
      create: {
        farmId,
        templateId: tpl.id,
        title: tpl.name,
        taskType: tpl.taskType,
        unitId: tpl.unitId ?? undefined,
        dueDate,
        assignedWorkerId: tpl.assignedWorkerId ?? undefined,
      },
    });
  }
  return due;
}

/** Mark still-PENDING tasks whose dueDate is before today as MISSED. Returns # swept. */
export async function sweepMissed(farmId: string, asOf: Date): Promise<number> {
  const today = dayBounds(asOf);
  const res = await prisma.task.updateMany({
    where: { farmId, status: 'PENDING', dueDate: { lt: today } },
    data: { status: 'MISSED' },
  });
  return res.count;
}

/** All farm ids (for the scheduled job to sweep across tenants). */
export async function allFarmIds(): Promise<string[]> {
  const farms = await prisma.farm.findMany({ where: { deletedAt: null }, select: { id: true } });
  return farms.map((f) => f.id);
}
