import type { NotificationStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import { makeNotificationService, MockNotificationService, type NotificationChannel } from './notification.service';

type DispatchInput = {
  channel?: NotificationChannel;
  recipient?: string;
  /** Only dispatch flags of this severity (e.g. the proactive sweep routes CRITICAL only). */
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
};

/**
 * Route alerts for OPEN risk flags that haven't been notified yet. One notification per flag
 * (idempotent — re-dispatch skips already-notified flags). Uses the configured NotificationService
 * (mock by default → no spend), recording each send in NotificationLog.
 */
export async function dispatchAlerts(farmId: string, userId: string, input: DispatchInput) {
  const channel = input.channel ?? 'SMS';
  const recipient = input.recipient ?? 'farm-owner';

  const openFlags = await prisma.riskFlag.findMany({
    where: { farmId, status: 'OPEN', ...(input.severity ? { severity: input.severity } : {}) },
    select: { id: true, type: true, severity: true, reason: true },
  });
  if (openFlags.length === 0) return { dispatched: 0 };

  const alreadyNotified = await prisma.notificationLog.findMany({
    where: { farmId, riskFlagId: { in: openFlags.map((f) => f.id) } },
    select: { riskFlagId: true },
  });
  const notifiedIds = new Set(alreadyNotified.map((n) => n.riskFlagId));
  const pending = openFlags.filter((f) => !notifiedIds.has(f.id));

  const service = makeNotificationService();
  let dispatched = 0;
  for (const flag of pending) {
    const body = `[${flag.severity}] ${flag.type}: ${flag.reason}`;
    let result: Awaited<ReturnType<typeof service.send>>;
    try {
      result = await service.send({ channel, recipient, subject: flag.type, body });
    } catch (err) {
      // Real provider not configured → fall back to mock so the alert is still recorded.
      result = await new MockNotificationService().send();
      result.error = err instanceof Error ? err.message : 'send failed';
    }
    await prisma.notificationLog.create({
      data: {
        farmId,
        channel,
        recipient,
        subject: flag.type,
        body,
        status: result.status,
        riskFlagId: flag.id,
        providerRef: result.providerRef,
        error: result.error,
        createdBy: userId,
      },
    });
    dispatched += 1;
  }
  return { dispatched };
}

const ALERT_SELECT = {
  id: true,
  channel: true,
  recipient: true,
  subject: true,
  body: true,
  status: true,
  riskFlagId: true,
  createdAt: true,
} satisfies Prisma.NotificationLogSelect;

export type AlertListFilter = { q?: string; status?: NotificationStatus; from?: Date; to?: Date };

function alertWhere(farmId: string, f: AlertListFilter): Prisma.NotificationLogWhereInput {
  const where: Prisma.NotificationLogWhereInput = { farmId };
  if (f.q) where.OR = [{ subject: contains(f.q) }, { body: contains(f.q) }];
  if (f.status) where.status = f.status;
  const range = dateRange(f.from, f.to);
  if (range) where.createdAt = range;
  return where;
}

export async function listAlerts(farmId: string, filter: AlertListFilter = {}) {
  const rows = await prisma.notificationLog.findMany({
    where: alertWhere(farmId, filter),
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: ALERT_SELECT,
  });
  return rows;
}

export async function listAlertsPaged(farmId: string, p: ListQuery & AlertListFilter) {
  const where = alertWhere(farmId, p);
  const [items, total] = await Promise.all([
    prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(p), select: ALERT_SELECT }),
    prisma.notificationLog.count({ where }),
  ]);
  return envelope(items, total, p);
}

/** Cross-cutting intelligence dashboard summary. */
export async function dashboard(farmId: string) {
  const [openFlags, latestWeather, latestRates, alertCount] = await Promise.all([
    prisma.riskFlag.findMany({ where: { farmId, status: 'OPEN' }, select: { severity: true } }),
    prisma.weatherReading.findFirst({ where: { farmId }, orderBy: { fetchedAt: 'desc' }, select: { tempC: true, humidityPct: true, source: true, fetchedAt: true } }),
    prisma.marketRate.findMany({ where: { farmId }, orderBy: { fetchedAt: 'desc' }, select: { commodity: true, pricePaise: true, unit: true } }),
    prisma.notificationLog.count({ where: { farmId } }),
  ]);

  const bySeverity = { INFO: 0, WARNING: 0, CRITICAL: 0 } as Record<string, number>;
  for (const f of openFlags) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;

  // latest rate per commodity
  const seen = new Set<string>();
  const topRates: { commodity: string; pricePaise: string; unit: string }[] = [];
  for (const r of latestRates) {
    if (seen.has(r.commodity)) continue;
    seen.add(r.commodity);
    topRates.push({ commodity: r.commodity, pricePaise: r.pricePaise.toString(), unit: r.unit });
  }

  return {
    risks: { open: openFlags.length, bySeverity },
    alerts: { total: alertCount },
    weather: latestWeather,
    market: topRates.slice(0, 5),
  };
}
