import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'SpikeTest123!';
const email = 'spike-owner@ifm.local';
let token = '';
let farm = '';
let batchId = '';

const h = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farm });
const spikeFlag = () =>
  prisma.riskFlag.findFirst({ where: { farmId: farm, dedupeKey: { startsWith: 'MORTALITY_SPIKE:' } } });

suite('Mortality-spike risk flag (slice 11.7, integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: 'Spike Farm' } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken;
    farm = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Spike Farm' })
    ).body.farm.id;

    const sp = (await request(app).get('/api/farm/species').set(h())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (
      await request(app)
        .post('/api/farm/batches')
        .set(h())
        .send({ speciesId: chicken, code: 'SPIKE-B1', initialCount: 200 })
    ).body.batch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('below-threshold mortality (1% in 24h) → recorded, no flag', async () => {
    const res = await request(app).post('/api/farm/mortality').set(h()).send({ batchId, type: 'MORTALITY', count: 2 });
    expect(res.status).toBe(201);
    expect(res.body.currentCount).toBe(198);
    expect(await spikeFlag()).toBeNull();
  });

  it('above 2% in 24h → WARNING flag with batch code + numbers, deduped per batch/day', async () => {
    const res = await request(app).post('/api/farm/mortality').set(h()).send({ batchId, type: 'MORTALITY', count: 5 });
    expect(res.status).toBe(201); // 7 deaths / 200 = 3.5%

    const flag = await spikeFlag();
    expect(flag).toBeTruthy();
    expect(flag!.type).toBe('OTHER');
    expect(flag!.severity).toBe('WARNING');
    expect(flag!.status).toBe('OPEN');
    expect(flag!.reason).toContain('SPIKE-B1');
    expect(flag!.reason).toContain('7 deaths');
    expect(flag!.reason).toContain('3.5%');
  });

  it('above 5% in 24h → same flag escalates to CRITICAL (upsert, still one flag)', async () => {
    await request(app).post('/api/farm/mortality').set(h()).send({ batchId, type: 'MORTALITY', count: 6 });
    // 13 deaths / 200 = 6.5%
    const flags = await prisma.riskFlag.findMany({
      where: { farmId: farm, dedupeKey: { startsWith: 'MORTALITY_SPIKE:' } },
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]!.severity).toBe('CRITICAL');
    expect(flags[0]!.reason).toContain('6.5%');
  });

  it('CULL events do not feed the mortality-spike rule', async () => {
    const before = await spikeFlag();
    await request(app).post('/api/farm/mortality').set(h()).send({ batchId, type: 'CULL', count: 50 });
    const after = await spikeFlag();
    expect(after!.updatedAt.toISOString()).toBe(before!.updatedAt.toISOString());
    expect(after!.reason).toBe(before!.reason);
  });

  it('backdated deaths outside the 24h window do not count', async () => {
    // Fresh batch in the same farm; a large but old mortality event.
    const sp = (await request(app).get('/api/farm/species').set(h())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const oldBatch = (
      await request(app)
        .post('/api/farm/batches')
        .set(h())
        .send({ speciesId: chicken, code: 'SPIKE-B2', initialCount: 100 })
    ).body.batch.id;
    await request(app)
      .post('/api/farm/mortality')
      .set(h())
      .send({ batchId: oldBatch, type: 'MORTALITY', count: 50, occurredAt: '2026-01-01T08:00:00.000Z' });
    const flag = await prisma.riskFlag.findFirst({
      where: { farmId: farm, dedupeKey: { startsWith: `MORTALITY_SPIKE:${oldBatch}` } },
    });
    expect(flag).toBeNull();
  });
});
