import { prisma } from '../prisma';
import { AppError } from '../errors';
import { formatPaise } from '@ifm/shared';
import { makeNotificationService, MockNotificationService } from '../notifications/notification.service';
import { buildSummary } from './data';
import { renderSummaryPdf, renderSummaryXlsx } from './render';
import { nextRun, type Frequency } from './schedule.calc';

const SELECT = {
  id: true,
  name: true,
  frequency: true,
  format: true,
  channel: true,
  recipient: true,
  isActive: true,
  lastRunAt: true,
  nextRunAt: true,
} as const;

export type CreateScheduleInput = {
  name: string;
  frequency: Frequency;
  format?: 'pdf' | 'xlsx';
  channel?: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'WEBHOOK' | 'PUSH';
  recipient: string;
  nextRunAt?: string;
};

export async function createReportSchedule(farmId: string, userId: string, input: CreateScheduleInput) {
  return prisma.reportSchedule.create({
    data: {
      farmId,
      name: input.name,
      frequency: input.frequency,
      format: input.format ?? 'pdf',
      channel: input.channel ?? 'EMAIL',
      recipient: input.recipient,
      nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : new Date(),
      createdBy: userId,
    },
    select: SELECT,
  });
}

export async function listReportSchedules(farmId: string) {
  return prisma.reportSchedule.findMany({ where: { farmId, deletedAt: null }, orderBy: { nextRunAt: 'asc' }, select: SELECT });
}

export type UpdateScheduleInput = Partial<CreateScheduleInput> & { isActive?: boolean };

/** Edit / pause / resume a schedule. `isActive: false` stops runDueReports picking it up. */
export async function updateReportSchedule(farmId: string, userId: string, id: string, input: UpdateScheduleInput) {
  const existing = await prisma.reportSchedule.findFirst({ where: { id, farmId, deletedAt: null }, select: { id: true } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Report schedule not found');
  return prisma.reportSchedule.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      frequency: input.frequency,
      format: input.format,
      channel: input.channel,
      recipient: input.recipient,
      isActive: input.isActive,
      nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : undefined,
      updatedBy: userId,
    },
    select: SELECT,
  });
}

/** Soft-delete a schedule — hidden from the list and skipped by the runDueReports sweep. */
export async function deleteReportSchedule(farmId: string, userId: string, id: string) {
  const { count } = await prisma.reportSchedule.updateMany({
    where: { id, farmId, deletedAt: null },
    data: { deletedAt: new Date(), updatedBy: userId },
  });
  if (count === 0) throw new AppError(404, 'NOT_FOUND', 'Report schedule not found');
  return { ok: true as const, id };
}

/**
 * Generate the report and "deliver" it via the NotificationService (mock by default → no
 * spend, recorded in NotificationLog), then advance the schedule's next run. The report bytes
 * are produced (proving generation works) but not attached in the mock channel.
 */
async function runOne(schedule: { id: string; farmId: string; name: string; format: string; channel: string; recipient: string; frequency: Frequency }) {
  const summary = await buildSummary(schedule.farmId);
  // Produce the bytes so a failure here surfaces (real channels would attach this).
  const bytes = schedule.format === 'xlsx' ? await renderSummaryXlsx(summary) : await renderSummaryPdf(summary);

  const body = `${schedule.name}: revenue ${formatPaise(Number(summary.financial.revenuePaise))}, profit ${formatPaise(
    Number(summary.financial.profitPaise),
  )}, open risks ${summary.risks.open} (${schedule.format}, ${bytes.length} bytes)`;

  const service = makeNotificationService();
  let result;
  try {
    result = await service.send({ channel: schedule.channel as 'EMAIL', recipient: schedule.recipient, subject: schedule.name, body });
  } catch (err) {
    result = await new MockNotificationService().send();
    result.error = err instanceof Error ? err.message : 'send failed';
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.notificationLog.create({
      data: {
        farmId: schedule.farmId,
        channel: schedule.channel as 'EMAIL',
        recipient: schedule.recipient,
        subject: schedule.name,
        body,
        status: result.status,
        providerRef: result.providerRef,
        error: result.error,
      },
    }),
    prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt: nextRun(now, schedule.frequency) },
    }),
  ]);

  return { delivered: true, bytes: bytes.length };
}

export async function runScheduleNow(farmId: string, id: string) {
  const s = await prisma.reportSchedule.findFirst({
    where: { id, farmId, deletedAt: null },
    select: { id: true, farmId: true, name: true, format: true, channel: true, recipient: true, frequency: true },
  });
  if (!s) throw new AppError(404, 'NOT_FOUND', 'Report schedule not found');
  return runOne(s);
}

/** Sweep: run every active schedule whose nextRunAt has passed (called by the daily job). */
export async function runDueReports(now = new Date()) {
  const due = await prisma.reportSchedule.findMany({
    where: { isActive: true, deletedAt: null, nextRunAt: { lte: now } },
    select: { id: true, farmId: true, name: true, format: true, channel: true, recipient: true, frequency: true },
  });
  let ran = 0;
  for (const s of due) {
    await runOne(s);
    ran += 1;
  }
  return { ran };
}
