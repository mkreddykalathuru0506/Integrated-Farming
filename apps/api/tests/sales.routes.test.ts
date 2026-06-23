import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'SalesTest123!';
const emails = { owner: 'salestest-owner@ifm.local', labour: 'salestest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let customerId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Sales orders (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Sales Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Sales Farm', state: 'Telangana' })
    ).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
    customerId = (await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'Wholesale Buyer', state: 'Telangana' })).body
      .customer.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('creates an order with computed totals + sequential SO number', async () => {
    const res = await request(app)
      .post('/api/farm/orders')
      .set(h(ownerToken))
      .send({
        customerId,
        lines: [
          { description: 'Whole dressed chicken', qty: 100, unit: 'kg', unitPricePaise: 18000 },
          { description: 'Eggs (tray)', qty: 50, unit: 'units', unitPricePaise: 15000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('DRAFT');
    expect(res.body.order.lines[0].lineTotalPaise).toBe('1800000');
    expect(res.body.order.totalPaise).toBe('2550000'); // 1,800,000 + 750,000
    expect(res.body.order.orderNumber).toMatch(/^SO-\d{4}-\d{2}-0001$/);
  });

  it('second order increments the number', async () => {
    const res = await request(app)
      .post('/api/farm/orders')
      .set(h(ownerToken))
      .send({ customerId, lines: [{ description: 'Broiler', qty: 1, unitPricePaise: 20000 }] });
    expect(res.body.order.orderNumber).toMatch(/-0002$/);
  });

  it('confirms a DRAFT order, then blocks re-confirm', async () => {
    const order = (
      await request(app)
        .post('/api/farm/orders')
        .set(h(ownerToken))
        .send({ customerId, lines: [{ description: 'x', qty: 1, unitPricePaise: 100 }] })
    ).body.order;
    const ok = await request(app).patch(`/api/farm/orders/${order.id}/status`).set(h(ownerToken)).send({ status: 'CONFIRMED' });
    expect(ok.status).toBe(200);
    expect(ok.body.order.status).toBe('CONFIRMED');
    const again = await request(app).patch(`/api/farm/orders/${order.id}/status`).set(h(ownerToken)).send({ status: 'CANCELLED' });
    expect(again.status).toBe(422); // not DRAFT anymore
  });

  it('rejects an order for a customer from another farm (422) and LABOUR create (403)', async () => {
    const bad = await request(app)
      .post('/api/farm/orders')
      .set(h(ownerToken))
      .send({ customerId: 'cust-does-not-exist', lines: [{ description: 'x', qty: 1, unitPricePaise: 100 }] });
    expect(bad.status).toBe(422);

    const lab = await request(app)
      .post('/api/farm/orders')
      .set(h(labourToken))
      .send({ customerId, lines: [{ description: 'x', qty: 1, unitPricePaise: 100 }] });
    expect(lab.status).toBe(403);
  });
});
