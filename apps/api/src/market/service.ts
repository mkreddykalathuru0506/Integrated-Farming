import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
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

/** Latest rate per commodity (newest first). */
export async function listRates(farmId: string) {
  const rows = await prisma.marketRate.findMany({
    where: { farmId },
    orderBy: { fetchedAt: 'desc' },
    select: { id: true, commodity: true, market: true, pricePaise: true, unit: true, source: true, observedAt: true, fetchedAt: true },
  });
  const latestByCommodity = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestByCommodity.has(r.commodity)) latestByCommodity.set(r.commodity, r);
  return [...latestByCommodity.values()].map(rateDTO);
}
