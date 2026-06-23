import { prisma } from '../prisma';
import { farmPnl } from '../invoices/service';

export type ReportSummary = {
  farm: { name: string; state: string | null; fssaiLicenseNo: string | null };
  range: { from: string | null; to: string | null };
  generatedAt: Date;
  financial: { revenuePaise: string; costPaise: string; profitPaise: string };
  livestock: { activeBatches: number; totalBirds: number; mortalityEvents: number; mortalityCount: number };
  feed: { consumptionKg: number; consumptionCostPaise: string };
  market: { commodity: string; pricePaise: string; unit: string }[];
  risks: { open: number; critical: number };
};

/** Aggregates a farm-wide summary for the report renderers. Money stays integer paise. */
export async function buildSummary(farmId: string, from?: Date, to?: Date): Promise<ReportSummary> {
  const occurredFilter = from || to ? { gte: from, lte: to } : undefined;

  const [farm, pnl, batches, mortality, feedTxns, rates, openRisks] = await Promise.all([
    prisma.farm.findUniqueOrThrow({
      where: { id: farmId },
      select: { name: true, state: true, settings: { select: { fssaiLicenseNo: true } } },
    }),
    farmPnl(farmId),
    prisma.batch.findMany({ where: { farmId, deletedAt: null, status: 'ACTIVE' }, select: { currentCount: true } }),
    prisma.mortalityEvent.findMany({
      where: { farmId, ...(occurredFilter ? { occurredAt: occurredFilter } : {}) },
      select: { count: true },
    }),
    prisma.feedTransaction.findMany({
      where: { farmId, type: 'CONSUMPTION', ...(occurredFilter ? { occurredAt: occurredFilter } : {}) },
      select: { qty: true, totalPaise: true },
    }),
    prisma.marketRate.findMany({ where: { farmId }, orderBy: { fetchedAt: 'desc' }, select: { commodity: true, pricePaise: true, unit: true } }),
    prisma.riskFlag.findMany({ where: { farmId, status: 'OPEN' }, select: { severity: true } }),
  ]);

  const totalBirds = batches.reduce((s, b) => s + b.currentCount, 0);
  const mortalityCount = mortality.reduce((s, m) => s + m.count, 0);
  const consumptionKg = feedTxns.reduce((s, f) => s + Number(f.qty), 0);
  const consumptionCostPaise = feedTxns.reduce((s, f) => s + (f.totalPaise ?? 0n), 0n);

  const seen = new Set<string>();
  const market: ReportSummary['market'] = [];
  for (const r of rates) {
    if (seen.has(r.commodity)) continue;
    seen.add(r.commodity);
    market.push({ commodity: r.commodity, pricePaise: r.pricePaise.toString(), unit: r.unit });
  }

  return {
    farm: { name: farm.name, state: farm.state, fssaiLicenseNo: farm.settings?.fssaiLicenseNo ?? null },
    range: { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null },
    generatedAt: new Date(),
    financial: pnl,
    livestock: {
      activeBatches: batches.length,
      totalBirds,
      mortalityEvents: mortality.length,
      mortalityCount,
    },
    feed: { consumptionKg, consumptionCostPaise: consumptionCostPaise.toString() },
    market: market.slice(0, 10),
    risks: { open: openRisks.length, critical: openRisks.filter((r) => r.severity === 'CRITICAL').length },
  };
}
