import { prisma } from '../prisma';
import { AppError } from '../errors';
import { batchFcr } from '../feed/service';
import { batchCost } from '../finance/service';

/** One entry of the merged batch timeline (newest first, capped at 100). */
type TimelineEntry = { at: Date; kind: string } & Record<string, unknown>;

/**
 * Per-batch drill-down aggregate (slice 11.5a): FCR + cost roll-up (reused services)
 * plus feed/weight/mortality series and a merged event timeline. Read-only.
 */
export async function batchPerformance(farmId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, farmId, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      initialCount: true,
      currentCount: true,
      acquiredAt: true,
      createdAt: true,
      species: { select: { id: true, name: true } },
      currentStage: { select: { name: true } },
    },
  });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch not found');

  const [fcr, cost, feedTxns, weights, mortality, movements, medications, vaccinations, processing] =
    await Promise.all([
      batchFcr(farmId, batchId),
      batchCost(farmId, batchId),
      prisma.feedTransaction.findMany({
        where: { farmId, batchId, type: 'CONSUMPTION' },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true, qty: true },
      }),
      prisma.dailyLog.findMany({
        where: { farmId, batchId, type: 'WEIGHT' },
        orderBy: { loggedAt: 'asc' },
        select: { loggedAt: true, quantity: true, unit: true },
      }),
      prisma.mortalityEvent.findMany({
        where: { farmId, batchId },
        orderBy: { occurredAt: 'asc' },
        select: { occurredAt: true, type: true, count: true, cause: true },
      }),
      prisma.movement.findMany({
        where: { farmId, batchId },
        select: { movedAt: true, fromUnitId: true, toUnitId: true, count: true, reason: true },
      }),
      prisma.medicationLog.findMany({
        where: { farmId, batchId },
        select: { administeredAt: true, drugName: true, withdrawalUntil: true },
      }),
      prisma.vaccinationEvent.findMany({
        where: { farmId, batchId },
        select: { administeredAt: true, vaccineName: true },
      }),
      prisma.processingRun.findMany({
        where: { farmId, sourceBatchId: batchId },
        select: { processedAt: true, inputCount: true },
      }),
    ]);

  // Cumulative feed consumption (Decimal qty summed as number, emitted as string).
  let cumKg = 0;
  const feedSeries = feedTxns.map((t) => {
    cumKg += Number(t.qty);
    return { occurredAt: t.occurredAt, qty: t.qty.toString(), cumulativeKg: cumKg.toString() };
  });

  // Cumulative mortality + rate against the initial count.
  let cumLoss = 0;
  const mortalitySeries = mortality.map((m) => {
    cumLoss += m.count;
    return { occurredAt: m.occurredAt, type: m.type, count: m.count, cumulative: cumLoss };
  });
  const ratePct =
    batch.initialCount > 0 ? Math.round((100 * cumLoss * 10) / batch.initialCount) / 10 : 0;

  const timeline: TimelineEntry[] = [
    { at: batch.createdAt, kind: 'created' },
    ...movements.map((m) => ({
      at: m.movedAt,
      kind: 'movement',
      fromUnitId: m.fromUnitId,
      toUnitId: m.toUnitId,
      count: m.count,
      reason: m.reason,
    })),
    ...mortality.map((m) => ({ at: m.occurredAt, kind: 'mortality', type: m.type, count: m.count, cause: m.cause })),
    ...medications.map((m) => ({
      at: m.administeredAt,
      kind: 'medication',
      drugName: m.drugName,
      withdrawalUntil: m.withdrawalUntil,
    })),
    ...vaccinations.map((v) => ({ at: v.administeredAt, kind: 'vaccination', vaccineName: v.vaccineName })),
    ...processing.map((p) => ({ at: p.processedAt, kind: 'processing', inputCount: p.inputCount })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 100);

  return {
    batch: {
      id: batch.id,
      code: batch.code,
      name: batch.name,
      status: batch.status,
      initialCount: batch.initialCount,
      currentCount: batch.currentCount,
      acquiredAt: batch.acquiredAt,
      species: batch.species,
      currentStage: batch.currentStage ? { name: batch.currentStage.name } : null,
    },
    fcr,
    cost,
    feedSeries,
    weightSeries: weights,
    mortality: { ratePct, series: mortalitySeries },
    timeline,
  };
}
