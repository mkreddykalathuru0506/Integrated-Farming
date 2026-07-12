import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { contains, dateRange, envelope, skipTake, type ListQuery } from '../http/list-query';
import { priceDropRisk } from '../intelligence/rules';
import { raiseFlag } from '../intelligence/service';
import { makeMarketRateProvider, MockMarketRateProvider, type MarketObservation } from './provider';
import type { RecordRateInput, RefreshRateInput } from './schemas';

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function rateDTO(r: {
  id: string;
  commodity: string;
  market: string | null;
  pricePaise: bigint;
  unit: string;
  source: string;
  observedAt: Date;
  fetchedAt: Date;
}) {
  return {
    id: r.id,
    commodity: r.commodity,
    market: r.market,
    pricePaise: r.pricePaise.toString(),
    unit: r.unit,
    source: r.source,
    observedAt: r.observedAt,
    fetchedAt: r.fetchedAt,
  };
}

/** Store a rate and, if it dropped ≥ threshold vs the prior reading, raise a PRICE_DROP flag. */
async function storeRate(
  farmId: string,
  userId: string | undefined,
  obs: { commodity: string; market: string | null; pricePaise: bigint; unit: string; source: string; observedAt: Date },
) {
  const prev = await prisma.marketRate.findFirst({
    where: { farmId, commodity: obs.commodity },
    orderBy: { fetchedAt: 'desc' },
    select: { pricePaise: true },
  });

  const created = await prisma.marketRate.create({
    data: {
      farmId,
      commodity: obs.commodity,
      market: obs.market,
      pricePaise: obs.pricePaise,
      unit: obs.unit,
      source: obs.source,
      observedAt: obs.observedAt,
      createdBy: userId,
    },
  });

  let risk: ReturnType<typeof priceDropRisk> | undefined;
  if (prev) {
    risk = priceDropRisk(prev.pricePaise, obs.pricePaise);
    if (risk.atRisk) {
      await raiseFlag(farmId, {
        type: 'PRICE_DROP',
        severity: risk.severity,
        reason: `${obs.commodity}: ${risk.reason}`,
        detail: { commodity: obs.commodity, prevPaise: prev.pricePaise.toString(), currPaise: obs.pricePaise.toString(), source: obs.source },
        source: obs.source,
        dedupeKey: `PRICE_DROP:${obs.commodity}:${dayKey(obs.observedAt)}`,
      });
    }
  }

  return { rate: rateDTO(created), risk };
}

export async function recordRate(farmId: string, userId: string, input: RecordRateInput) {
  return storeRate(farmId, userId, {
    commodity: input.commodity,
    market: input.market ?? null,
    pricePaise: BigInt(input.pricePaise),
    unit: input.unit,
    source: 'manual',
    observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
  });
}

export async function refreshRate(farmId: string, userId: string, input: RefreshRateInput) {
  let obs: MarketObservation;
  try {
    obs = await makeMarketRateProvider().getRate(input.commodity, input.market);
  } catch {
    obs = await new MockMarketRateProvider().getRate(input.commodity, input.market); // graceful fallback
  }
  return storeRate(farmId, userId, {
    commodity: obs.commodity,
    market: obs.market,
    pricePaise: obs.pricePaise,
    unit: obs.unit,
    source: obs.source,
    observedAt: obs.observedAt,
  });
}

const RATE_SELECT = {
  id: true,
  commodity: true,
  market: true,
  pricePaise: true,
  unit: true,
  source: true,
  observedAt: true,
  fetchedAt: true,
} satisfies Prisma.MarketRateSelect;

export type RateListFilter = { q?: string; from?: Date; to?: Date };

function rateWhere(farmId: string, f: RateListFilter): Prisma.MarketRateWhereInput {
  const where: Prisma.MarketRateWhereInput = { farmId };
  if (f.q) where.commodity = contains(f.q);
  const range = dateRange(f.from, f.to);
  if (range) where.observedAt = range;
  return where;
}

/** Latest rate per commodity (newest first). */
export async function listRates(farmId: string, filter: RateListFilter = {}) {
  const rows = await prisma.marketRate.findMany({
    where: rateWhere(farmId, filter),
    orderBy: { fetchedAt: 'desc' },
    select: RATE_SELECT,
  });
  const latestByCommodity = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByCommodity.has(r.commodity)) latestByCommodity.set(r.commodity, r);
  return [...latestByCommodity.values()].map(rateDTO);
}

/** Paged mode returns raw observations (newest first) — not latest-per-commodity. */
export async function listRatesPaged(farmId: string, p: ListQuery & RateListFilter) {
  const where = rateWhere(farmId, p);
  const [rows, total] = await Promise.all([
    prisma.marketRate.findMany({ where, orderBy: { observedAt: 'desc' }, ...skipTake(p), select: RATE_SELECT }),
    prisma.marketRate.count({ where }),
  ]);
  return envelope(rows.map(rateDTO), total, p);
}

/**
 * Full observation history for one commodity, asc by observedAt (chart-ready).
 * Default window = last 90 days when from/to absent; capped at 1000 rows.
 */
export async function rateHistory(
  farmId: string,
  commodity: string,
  p: { from?: Date; to?: Date; page?: number; pageSize: number },
) {
  const from = p.from ?? (p.to ? undefined : new Date(Date.now() - 90 * 86_400_000));
  const where: Prisma.MarketRateWhereInput = { farmId, commodity };
  const range = dateRange(from, p.to);
  if (range) where.observedAt = range;

  if (p.page) {
    const [rows, total] = await Promise.all([
      prisma.marketRate.findMany({ where, orderBy: { observedAt: 'asc' }, ...skipTake(p), select: RATE_SELECT }),
      prisma.marketRate.count({ where }),
    ]);
    return envelope(rows.map(rateDTO), total, p);
  }
  const rows = await prisma.marketRate.findMany({
    where,
    orderBy: { observedAt: 'asc' },
    take: 1000,
    select: RATE_SELECT,
  });
  return { rates: rows.map(rateDTO) };
}
