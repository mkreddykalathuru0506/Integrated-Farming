import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'PerfTest123!';
const email = 'perftest-owner@ifm.local';
let token = '';
let farmA = '';
let farmB = '';
let batchId = '';
let emptyBatchId = '';

const hA = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

suite('GET /api/farm/batches/:id/performance (slice 11.5a)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Perf Farm A', 'Perf Farm B'] } } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken;
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Perf Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Perf Farm B' })).body.farm.id;

    const sp = (await request(app).get('/api/farm/species').set(hA())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (
      await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chicken, code: 'PF-B1', name: 'Perf Flock', initialCount: 100, acquiredAt: daysAgo(20) })
    ).body.batch.id;
    emptyBatchId = (
      await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chicken, code: 'PF-B2', initialCount: 10 })
    ).body.batch.id;

    // Feed: purchase 100kg @300p/kg → consume 30kg (d-10) + 20kg (d-5) → cost 9000 + 6000
    const item = (await request(app).post('/api/farm/feed').set(hA()).send({ name: 'PF Starter', unit: 'kg' })).body.item.id;
    await request(app).post('/api/farm/feed/purchase').set(hA()).send({ feedItemId: item, qty: 100, unitPricePaise: 300, occurredAt: daysAgo(12) });
    await request(app).post('/api/farm/feed/consume').set(hA()).send({ feedItemId: item, batchId, qty: 30, occurredAt: daysAgo(10) });
    await request(app).post('/api/farm/feed/consume').set(hA()).send({ feedItemId: item, batchId, qty: 20, occurredAt: daysAgo(5) });

    // Weights: 50kg (d-12) → 90kg (d-2) → gain 40kg
    await request(app).post('/api/farm/logs').set(hA()).send({ type: 'WEIGHT', batchId, quantity: 50, unit: 'kg', loggedAt: daysAgo(12) });
    await request(app).post('/api/farm/logs').set(hA()).send({ type: 'WEIGHT', batchId, quantity: 90, unit: 'kg', loggedAt: daysAgo(2) });

    // Mortality: 10 dead (d-8), 5 culled (d-4) → rate 15%
    await request(app).post('/api/farm/mortality').set(hA()).send({ batchId, type: 'MORTALITY', count: 10, cause: 'heat', occurredAt: daysAgo(8) });
    await request(app).post('/api/farm/mortality').set(hA()).send({ batchId, type: 'CULL', count: 5, occurredAt: daysAgo(4) });

    // Expense attributed to the batch
    await request(app).post('/api/farm/expenses').set(hA()).send({ category: 'LABOUR', amountPaise: 5000, batchId, occurredAt: daysAgo(6) });

    // Medication + vaccination + movement for the timeline
    await request(app).post('/api/farm/health/medications').set(hA()).send({ batchId, drugName: 'Enrofloxacin', withdrawalDays: 5, administeredAt: daysAgo(3) });
    await request(app).post('/api/farm/health/vaccinations').set(hA()).send({ batchId, vaccineName: "Marek's" });
    const unit = (await request(app).post('/api/farm/units').set(hA()).send({ name: 'PF Shed', type: 'POULTRY' })).body.unit.id;
    await request(app).post('/api/farm/movements').set(hA()).send({ batchId, toUnitId: unit, reason: 'grow-out' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('returns batch header, FCR, cost roll-up and series with correct math', async () => {
    const res = await request(app).get(`/api/farm/batches/${batchId}/performance`).set(hA());
    expect(res.status).toBe(200);
    const b = res.body;

    expect(b.batch).toMatchObject({ id: batchId, code: 'PF-B1', name: 'Perf Flock', status: 'ACTIVE', initialCount: 100, currentCount: 85 });
    expect(b.batch.species.name).toBeTruthy();

    // FCR: 50kg feed / 40kg gain = 1.25; cost 15000p feed
    expect(b.fcr).toMatchObject({ feedConsumedKg: 50, weightGainKg: 40, fcr: 1.25, feedCostPaise: '15000' });

    // Cost roll-up: FEED 15000 + LABOUR 5000 = 20000; per bird = 20000/85 = 235 (floor)
    expect(b.cost.totalPaise).toBe('20000');
    expect(b.cost.byCategory).toEqual({ FEED: '15000', LABOUR: '5000' });
    expect(b.cost.costPerBirdPaise).toBe('235');

    // Feed series asc with cumulative
    expect(b.feedSeries.map((f: { qty: string; cumulativeKg: string }) => [f.qty, f.cumulativeKg])).toEqual([
      ['30', '30'],
      ['20', '50'],
    ]);

    // Weight series asc
    expect(b.weightSeries.map((w: { quantity: number }) => w.quantity)).toEqual([50, 90]);

    // Mortality: cumulative series + rate
    expect(b.mortality.ratePct).toBe(15);
    expect(b.mortality.series.map((m: { count: number; cumulative: number }) => [m.count, m.cumulative])).toEqual([
      [10, 10],
      [5, 15],
    ]);
  });

  it('merges a desc timeline with created/movement/mortality/medication/vaccination kinds', async () => {
    const res = await request(app).get(`/api/farm/batches/${batchId}/performance`).set(hA());
    const kinds = res.body.timeline.map((t: { kind: string }) => t.kind);
    expect(kinds).toContain('created');
    expect(kinds).toContain('movement');
    expect(kinds).toContain('mortality');
    expect(kinds).toContain('medication');
    expect(kinds).toContain('vaccination');

    const med = res.body.timeline.find((t: { kind: string }) => t.kind === 'medication');
    expect(med.drugName).toBe('Enrofloxacin');
    expect(med.withdrawalUntil).toBeTruthy();

    const times = res.body.timeline.map((t: { at: string }) => new Date(t.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times); // newest first
  });

  it('empty batch → zeros and empty arrays; unknown/foreign batch → 404', async () => {
    const res = await request(app).get(`/api/farm/batches/${emptyBatchId}/performance`).set(hA());
    expect(res.status).toBe(200);
    expect(res.body.fcr.feedConsumedKg).toBe(0);
    expect(res.body.cost.totalPaise).toBe('0');
    expect(res.body.feedSeries).toEqual([]);
    expect(res.body.mortality.ratePct).toBe(0);
    expect(res.body.mortality.series).toEqual([]);
    expect(res.body.timeline.map((t: { kind: string }) => t.kind)).toEqual(['created']);

    expect((await request(app).get(`/api/farm/batches/${batchId}/performance`).set(hB())).status).toBe(404);
    expect((await request(app).get('/api/farm/batches/nope/performance').set(hA())).status).toBe(404);
  });
});
