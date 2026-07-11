import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'HistTest123!';
const email = 'histtest-owner@ifm.local';
let token = '';
let farmA = '';
let farmB = '';
let storeId = '';

const hA = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

suite('Market history + cold-storage temps window (slice 11.5a)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Hist Farm A', 'Hist Farm B'] } } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken;
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Hist Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Hist Farm B' })).body.farm.id;

    // Broiler: 100d ago (outside default 90d window), 10d ago, 5d ago; Egg: 3d ago
    for (const [paise, d] of [
      [12000, 100],
      [10000, 10],
      [9000, 5],
    ] as const) {
      await request(app)
        .post('/api/farm/market')
        .set(hA())
        .send({ commodity: 'Broiler', pricePaise: paise, unit: 'kg', observedAt: daysAgo(d).toISOString() });
    }
    await request(app).post('/api/farm/market').set(hA()).send({ commodity: 'Egg', pricePaise: 600, unit: 'dozen', observedAt: daysAgo(3).toISOString() });
    await request(app).post('/api/farm/market').set(hB()).send({ commodity: 'Broiler', pricePaise: 7000, unit: 'kg', observedAt: daysAgo(2).toISOString() });

    // Cold store with temps at controlled timestamps (insert directly — recordedAt defaults to now via API)
    storeId = (
      await request(app).post('/api/farm/coldstorage').set(hA()).send({ name: 'Hist Freezer', mode: 'FRESH' })
    ).body.store.id;
    await prisma.temperatureLog.createMany({
      data: [
        { farmId: farmA, coldStorageId: storeId, temperatureC: 4, isOutOfRange: false, source: 'manual', recordedAt: daysAgo(3) },
        { farmId: farmA, coldStorageId: storeId, temperatureC: 9, isOutOfRange: true, source: 'manual', recordedAt: daysAgo(2) },
        { farmId: farmA, coldStorageId: storeId, temperatureC: 5, isOutOfRange: false, source: 'manual', recordedAt: daysAgo(1) },
        { farmId: farmA, coldStorageId: storeId, temperatureC: 3, isOutOfRange: false, source: 'manual', recordedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('market history: default window = last 90 days, asc, farm-scoped', async () => {
    const res = await request(app).get('/api/farm/market/history?commodity=Broiler').set(hA());
    expect(res.status).toBe(200);
    expect(res.body.rates).toHaveLength(2); // 100d-old obs outside window; farm B's rate invisible
    expect(res.body.rates[0].pricePaise).toBe('10000'); // asc: 10d ago first
    expect(res.body.rates[1].pricePaise).toBe('9000');
  });

  it('market history: explicit from widens the window; paged envelope; commodity required', async () => {
    const wide = await request(app)
      .get(`/api/farm/market/history?commodity=Broiler&from=${daysAgo(120).toISOString()}`)
      .set(hA());
    expect(wide.body.rates).toHaveLength(3);
    expect(wide.body.rates[0].pricePaise).toBe('12000');

    const paged = await request(app).get('/api/farm/market/history?commodity=Broiler&page=1&pageSize=1').set(hA());
    expect(paged.body.total).toBe(2);
    expect(paged.body.items).toHaveLength(1);

    const missing = await request(app).get('/api/farm/market/history').set(hA());
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('COMMODITY_REQUIRED');

    const otherFarm = await request(app).get('/api/farm/market/history?commodity=Broiler').set(hB());
    expect(otherFarm.body.rates).toHaveLength(1);
    expect(otherFarm.body.rates[0].pricePaise).toBe('7000');
  });

  it('temps: legacy call unchanged (desc, take 50)', async () => {
    const res = await request(app).get(`/api/farm/coldstorage/${storeId}/temps`).set(hA());
    expect(res.status).toBe(200);
    expect(res.body.temps).toHaveLength(4);
    expect(res.body.temps[0].temperatureC).toBe(3); // newest first
  });

  it('temps: from/to window returns only in-range readings, asc for charting', async () => {
    const from = daysAgo(2.5).toISOString();
    const to = daysAgo(0.5).toISOString();
    const res = await request(app).get(`/api/farm/coldstorage/${storeId}/temps?from=${from}&to=${to}`).set(hA());
    expect(res.body.temps).toHaveLength(2);
    expect(res.body.temps.map((t: { temperatureC: number }) => t.temperatureC)).toEqual([9, 5]); // asc
  });

  it('temps: paged envelope; store farm-scoped (404); bad date 400', async () => {
    const paged = await request(app).get(`/api/farm/coldstorage/${storeId}/temps?page=2&pageSize=3`).set(hA());
    expect(paged.body.total).toBe(4);
    expect(paged.body.items).toHaveLength(1);

    const idor = await request(app).get(`/api/farm/coldstorage/${storeId}/temps`).set(hB());
    expect(idor.status).toBe(404);

    expect((await request(app).get(`/api/farm/coldstorage/${storeId}/temps?from=garbage`).set(hA())).status).toBe(400);
  });
});
