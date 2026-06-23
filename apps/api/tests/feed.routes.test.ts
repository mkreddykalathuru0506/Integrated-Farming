import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'FeedTest123!';
const emails = { owner: 'feedtest-owner@ifm.local', labour: 'feedtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Feed inventory (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Feed Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Feed Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  let itemId = '';
  it('creates a feed item; duplicate name → 409', async () => {
    const res = await request(app).post('/api/farm/feed').set(h(ownerToken)).send({ name: 'Broiler Starter', unit: 'kg', reorderThreshold: 100 });
    expect(res.status).toBe(201);
    expect(res.body.item.stockQty).toBe('0');
    itemId = res.body.item.id;
    const dup = await request(app).post('/api/farm/feed').set(h(ownerToken)).send({ name: 'Broiler Starter' });
    expect(dup.status).toBe(409);
  });

  it('a purchase increases stock and sets last price', async () => {
    const res = await request(app).post('/api/farm/feed/purchase').set(h(ownerToken)).send({ feedItemId: itemId, qty: 50, unitPricePaise: 4000 });
    expect(res.status).toBe(201);
    expect(res.body.item.stockQty).toBe('50');
    expect(res.body.item.lastUnitPricePaise).toBe('4000');
    expect(res.body.totalPaise).toBe('200000'); // 50 × ₹40 = ₹2000
  });

  it('low-stock list shows items below threshold', async () => {
    const res = await request(app).get('/api/farm/feed/low-stock').set(h(ownerToken));
    // stock 50 < threshold 100 → present
    expect(res.body.items.map((i: { id: string }) => i.id)).toContain(itemId);
  });

  it('LABOUR cannot create a feed item (403)', async () => {
    const res = await request(app).post('/api/farm/feed').set(h(labourToken)).send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});
