import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { heatStressRisk } from './rules';
import { makeWeatherProvider, MockWeatherProvider, type WeatherObservation } from './weather.provider';

const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

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
export async function getWeather(farmId: string, force = false) {
  const settings = await prisma.farmSetting.findUnique({ where: { farmId }, select: { latitude: true, longitude: true } });
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
    obs = await makeWeatherProvider().getCurrent(settings.latitude, settings.longitude);
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

  const risk = heatStressRisk(obs.tempC, obs.humidityPct);
  if (risk.atRisk) {
    await raiseFlag(farmId, {
      type: 'HEAT_STRESS',
      severity: risk.severity,
      reason: risk.reason,
      detail: { tempC: obs.tempC, humidityPct: obs.humidityPct, source: obs.source },
      source: obs.source,
      dedupeKey: `HEAT_STRESS:${dayKey(obs.observedAt)}`,
    });
  }

  return { weather: weatherDTO(reading), cached: false, risk };
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
