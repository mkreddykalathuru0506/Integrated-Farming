import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { raiseFlag, runIntelligenceSweep } from '../src/intelligence/service';
import { MockWeatherProvider } from '../src/intelligence/weather.provider';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'SweepTest123!';
const emails = { owner: 'sweep-owner@ifm.local', labour: 'sweep-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Proactive intelligence sweep (slice 11.7, integration, mock provider)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Sweep Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Sweep Farm' })
    ).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('endpoint requires a farm location (422) before sweeping', async () => {
    const res = await request(app).post('/api/farm/intelligence/sweep').set(h(ownerToken));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LOCATION_REQUIRED');
  });

  it('sweep body raises a THI flag and routes an alert for the new CRITICAL flag only', async () => {
    await request(app).put('/api/farm/settings').set(h(ownerToken)).send({ latitude: 17.385, longitude: 78.4867 });

    // A pre-existing WARNING flag must NOT be dispatched (severity filter).
    const warning = await raiseFlag(farm, {
      type: 'OTHER',
      severity: 'WARNING',
      reason: 'warning bait — must not be dispatched by the sweep',
      dedupeKey: 'SWEEP_TEST_WARNING',
    });

    // 40°C / 70% RH → THI 96.3 → emergency → CRITICAL.
    const result = await runIntelligenceSweep(farm, {
      provider: new MockWeatherProvider({ tempC: 40, humidityPct: 70 }),
      force: true,
    });

    expect(result.weather.tempC).toBe(40);
    expect(result.risk).toMatchObject({ atRisk: true, severity: 'CRITICAL' });
    expect(result.risk!.reason).toContain('THI 96.3');
    expect(result.dispatched).toBe(1); // the heat flag, not the WARNING bait

    const heat = await prisma.riskFlag.findFirst({ where: { farmId: farm, type: 'HEAT_STRESS', status: 'OPEN' } });
    expect(heat).toBeTruthy();
    expect(heat!.reason).toContain('THI 96.3');
    expect((heat!.detail as { thi: number }).thi).toBeCloseTo(96.3, 1);

    const logs = await prisma.notificationLog.findMany({ where: { farmId: farm } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.riskFlagId).toBe(heat!.id);
    expect(logs[0]!.createdBy).toBe('intelligence-sweep');
    const baitLog = logs.find((l) => l.riskFlagId === warning.id);
    expect(baitLog).toBeUndefined();
  });

  it('re-running the sweep is idempotent (no duplicate alert)', async () => {
    const again = await runIntelligenceSweep(farm, {
      provider: new MockWeatherProvider({ tempC: 40, humidityPct: 70 }),
    });
    expect(again.dispatched).toBe(0);
    expect(await prisma.notificationLog.count({ where: { farmId: farm } })).toBe(1);
  });

  it('POST /api/farm/intelligence/sweep: LABOUR → 403, OWNER → 200 with sweep summary', async () => {
    const lab = await request(app).post('/api/farm/intelligence/sweep').set(h(labourToken));
    expect(lab.status).toBe(403);

    const ok = await request(app).post('/api/farm/intelligence/sweep').set(h(ownerToken));
    expect(ok.status).toBe(200);
    expect(ok.body.weather.source).toBe('mock');
    expect(typeof ok.body.dispatched).toBe('number');
  });
});
