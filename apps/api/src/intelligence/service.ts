import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { dispatchAlerts } from '../notifications/service';
import { evaluateHeatRisk, mortalitySpikeRisk, type Locale } from './rules';
import { makeWeatherProvider, MockWeatherProvider, type WeatherObservation, type WeatherProvider } from './weather.provider';

const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

/** Farm's stored-text locale (RiskFlag.reason is composed server-side — see rules.ts). */
async function farmLocale(farmId: string): Promise<Locale> {
  const s = await prisma.farmSetting.findUnique({ where: { farmId }, select: { defaultLocale: true } });
  return s?.defaultLocale === 'hi' ? 'hi' : 'en';
}

type RaiseInput = {
  type: 'HEAT_STRESS' | 'COLD_STRESS' | 'PRICE_DROP' | 'LOW_STOCK' | 'OTHER';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  reason: string;
  detail?: Prisma.InputJsonValue;
  source?: string;
  dedupeKey: string;
};

/** Idempotently raise/update an OPEN risk flag for a (farm, dedupeKey). */
export async function raiseFlag(farmId: string, input: RaiseInput) {
  return prisma.riskFlag.upsert({
    where: { farmId_dedupeKey: { farmId, dedupeKey: input.dedupeKey } },
    create: {
      farmId,
      type: input.type,
      severity: input.severity,
      reason: input.reason,
      detail: input.detail,
      source: input.source,
      dedupeKey: input.dedupeKey,
    },
    update: { severity: input.severity, reason: input.reason, detail: input.detail },
    select: { id: true, type: true, severity: true, reason: true, status: true, dedupeKey: true },
  });
}

function weatherDTO(w: {
  tempC: number;
  humidityPct: number | null;
  condition: string | null;
  source: string;
  observedAt: Date;
  fetchedAt: Date;
}) {
  return {
    tempC: w.tempC,
    humidityPct: w.humidityPct,
    condition: w.condition,
    source: w.source,
    observedAt: w.observedAt,
    fetchedAt: w.fetchedAt,
  };
}

/**
 * Current weather for the farm. Cached daily; pass force=true to refetch.
 * Fetching evaluates the heat-stress rule and raises a risk flag (with the "why").
 * Provider errors degrade gracefully to the mock (no dead end).
 */
export async function getWeather(farmId: string, force = false, provider?: WeatherProvider) {
  const settings = await prisma.farmSetting.findUnique({
    where: { farmId },
    select: { latitude: true, longitude: true, defaultLocale: true },
  });
  if (settings?.latitude == null || settings?.longitude == null) {
    throw new AppError(422, 'LOCATION_REQUIRED', 'Set the farm latitude/longitude in settings to fetch weather');
  }

  if (!force) {
    const today = dayKey(new Date());
    const cached = await prisma.weatherReading.findFirst({ where: { farmId }, orderBy: { fetchedAt: 'desc' } });
    if (cached && dayKey(cached.fetchedAt) === today) {
      return { weather: weatherDTO(cached), cached: true };
    }
  }

  let obs: WeatherObservation;
  try {
    obs = await (provider ?? makeWeatherProvider()).getCurrent(settings.latitude, settings.longitude);
  } catch {
    obs = await new MockWeatherProvider().getCurrent(); // graceful fallback
  }

  const reading = await prisma.weatherReading.create({
    data: {
      farmId,
      tempC: obs.tempC,
      humidityPct: obs.humidityPct,
      condition: obs.condition,
      source: obs.source,
      observedAt: obs.observedAt,
    },
  });

  // THI banding when humidity is available; temperature-only fallback otherwise (rules.ts).
  const locale: Locale = settings.defaultLocale === 'hi' ? 'hi' : 'en';
  const risk = evaluateHeatRisk(obs.tempC, obs.humidityPct, locale);
  if (risk.atRisk) {
    await raiseFlag(farmId, {
      type: 'HEAT_STRESS',
      severity: risk.severity,
      reason: risk.reason,
      detail: { tempC: obs.tempC, humidityPct: obs.humidityPct, thi: risk.thi ?? null, source: obs.source },
      source: obs.source,
      dedupeKey: `HEAT_STRESS:${dayKey(obs.observedAt)}`,
    });
  }

  return { weather: weatherDTO(reading), cached: false, risk };
}

// ---------- Proactive sweep + mortality spike (slice 11.7) ----------

export type SweepDeps = {
  /** Injectable for tests/demos; defaults to the env-selected factory (mock in dev/CI). */
  provider?: WeatherProvider;
  /** Bypass the daily weather cache (used by the on-demand endpoint / web Refresh). */
  force?: boolean;
};

/**
 * Per-farm intelligence sweep: fetch weather (daily-cached), upsert THI/heat-stress flags,
 * then route alerts for OPEN CRITICAL flags via the idempotent dispatcher (already-notified
 * flags are skipped, so re-running never double-sends).
 */
export async function runIntelligenceSweep(farmId: string, deps: SweepDeps = {}) {
  const result = await getWeather(farmId, deps.force ?? false, deps.provider);
  const { dispatched } = await dispatchAlerts(farmId, 'intelligence-sweep', { severity: 'CRITICAL' });
  return {
    weather: result.weather,
    cached: result.cached ?? false,
    risk: 'risk' in result ? result.risk : undefined,
    dispatched,
  };
}

/** Sweep every farm that has a location set. Per-farm failures are isolated (logged, not fatal). */
export async function sweepAllFarms(deps: SweepDeps = {}) {
  const farms = await prisma.farmSetting.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { farmId: true },
  });
  let swept = 0;
  let dispatched = 0;
  let failed = 0;
  for (const f of farms) {
    try {
      const r = await runIntelligenceSweep(f.farmId, deps);
      swept += 1;
      dispatched += r.dispatched;
    } catch (err) {
      failed += 1;
      console.error(`[intelligence-sweep] farm ${f.farmId} failed`, err);
    }
  }
  return { farms: farms.length, swept, dispatched, failed };
}

/**
 * Evaluate the mortality-spike rule for a batch after a mortality write (called by the
 * livestock events service, outside its transaction). Upserts one OPEN flag per batch per
 * day (dedupeKey) — `type: OTHER` (no RiskType schema change in this slice).
 */
export async function evaluateMortalitySpike(
  farmId: string,
  batch: { id: string; code: string; currentCount: number },
  now = new Date(),
) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const agg = await prisma.mortalityEvent.aggregate({
    where: { farmId, batchId: batch.id, type: 'MORTALITY', occurredAt: { gte: since } },
    _sum: { count: true },
  });
  const deaths24h = agg._sum.count ?? 0;
  const locale = await farmLocale(farmId);
  const risk = mortalitySpikeRisk({ deaths24h, currentCount: batch.currentCount, batchCode: batch.code, locale });
  if (!risk.atRisk) return risk;
  await raiseFlag(farmId, {
    type: 'OTHER',
    severity: risk.severity,
    reason: risk.reason,
    detail: { rule: 'MORTALITY_SPIKE', batchId: batch.id, batchCode: batch.code, deaths24h, currentCount: batch.currentCount },
    source: 'mortality-rule',
    dedupeKey: `MORTALITY_SPIKE:${batch.id}:${dayKey(now)}`,
  });
  return risk;
}

export async function listRisks(farmId: string, status?: string) {
  const where: Prisma.RiskFlagWhereInput = { farmId };
  if (status) where.status = status as Prisma.RiskFlagWhereInput['status'];
  const rows = await prisma.riskFlag.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: { id: true, type: true, severity: true, reason: true, status: true, source: true, createdAt: true, acknowledgedAt: true },
  });
  return rows;
}

export async function acknowledgeRisk(farmId: string, id: string, userId: string) {
  const flag = await prisma.riskFlag.findFirst({ where: { id, farmId }, select: { id: true } });
  if (!flag) throw new AppError(404, 'NOT_FOUND', 'Risk flag not found');
  return prisma.riskFlag.update({
    where: { id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedBy: userId },
    select: { id: true, status: true, acknowledgedAt: true },
  });
}
