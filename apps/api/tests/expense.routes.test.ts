import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'ExpTest123!';
const emails = { owner: 'exptest-owner@ifm.local', labour: 'exptest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let feedId = '';
let batchId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Expenses + batch cost (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Exp Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Exp Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'EXP-BR', initialCount: 100 })).body.batch.id;
    // feed cost: buy + consume 100kg @ ₹40 = ₹4000 against the batch
    feedId = (await request(app).post('/api/farm/feed').set(h(ownerToken)).send({ name: 'Mash' })).body.item.id;
    await request(app).post('/api/farm/feed/purchase').set(h(ownerToken)).send({ feedItemId: feedId, qty: 200, unitPricePaise: 4000 });
    await request(app).post('/api/farm/feed/consume').set(h(ownerToken)).send({ feedItemId: feedId, batchId, qty: 100 });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('records an expense and rolls up batch cost (feed + expenses + per-bird)', async () => {
    const exp = await request(app).post('/api/farm/expenses').set(h(ownerToken)).send({ category: 'MEDICINE', amountPaise: 100000, batchId });
    expect(exp.status).toBe(201);

    const cost = await request(app).get(`/api/farm/expenses/batch-cost?batchId=${batchId}`).set(h(ownerToken));
    expect(cost.status).toBe(200);
    expect(cost.body.byCategory.FEED).toBe('400000'); // ₹4000 feed
    expect(cost.body.byCategory.MEDICINE).toBe('100000'); // ₹1000 medicine
    expect(cost.body.totalPaise).toBe('500000'); // ₹5000 total
    expect(cost.body.costPerBirdPaise).toBe('5000'); // ₹50 / bird (100 birds)
  });

  it('LABOUR cannot record an expense (403)', async () => {
    const res = await request(app).post('/api/farm/expenses').set(h(labourToken)).send({ category: 'OTHER', amountPaise: 100 });
    expect(res.status).toBe(403);
  });
});
