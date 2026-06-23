import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'FcrTest123!';
const emails = { owner: 'fcrtest-owner@ifm.local', labour: 'fcrtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let feedId = '';
let batchId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Feed consumption + FCR (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'FCR Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'FCR Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'FCR-BR', initialCount: 100 })).body.batch.id;
    feedId = (await request(app).post('/api/farm/feed').set(h(ownerToken)).send({ name: 'Grower Mash' })).body.item.id;
    await request(app).post('/api/farm/feed/purchase').set(h(ownerToken)).send({ feedItemId: feedId, qty: 500, unitPricePaise: 4000 });
    // weight logs: 50kg then 150kg → gain 100kg
    await request(app).post('/api/farm/logs').set(h(ownerToken)).send({ type: 'WEIGHT', batchId, quantity: 50, unit: 'kg' });
    await request(app).post('/api/farm/logs').set(h(ownerToken)).send({ type: 'WEIGHT', batchId, quantity: 150, unit: 'kg' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('consumption decrements stock and attributes cost; FCR computed', async () => {
    const c = await request(app).post('/api/farm/feed/consume').set(h(ownerToken)).send({ feedItemId: feedId, batchId, qty: 200 });
    expect(c.status).toBe(201);
    expect(c.body.item.stockQty).toBe('300'); // 500 - 200
    expect(c.body.costPaise).toBe('800000'); // 200 × ₹40 = ₹8000

    const fcr = await request(app).get(`/api/farm/feed/fcr?batchId=${batchId}`).set(h(ownerToken));
    expect(fcr.body.feedConsumedKg).toBe(200);
    expect(fcr.body.weightGainKg).toBe(100);
    expect(fcr.body.fcr).toBe(2);
  });

  it('consuming more than stock → 422 INSUFFICIENT_STOCK', async () => {
    const c = await request(app).post('/api/farm/feed/consume').set(h(ownerToken)).send({ feedItemId: feedId, batchId, qty: 99999 });
    expect(c.status).toBe(422);
    expect(c.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('LABOUR cannot record consumption (403)', async () => {
    const c = await request(app).post('/api/farm/feed/consume').set(h(labourToken)).send({ feedItemId: feedId, batchId, qty: 1 });
    expect(c.status).toBe(403);
  });
});
