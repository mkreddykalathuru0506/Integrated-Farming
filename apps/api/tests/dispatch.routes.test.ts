import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'DispTest123!';
const emails = { owner: 'disptest-owner@ifm.local', labour: 'disptest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let customerId = '';
let frozenLotId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

const confirmedOrder = async () => {
  const order = (
    await request(app)
      .post('/api/farm/orders')
      .set(h(ownerToken))
      .send({ customerId, lines: [{ description: 'Frozen chicken', qty: 10, unitPricePaise: 20000 }] })
  ).body.order;
  await request(app).patch(`/api/farm/orders/${order.id}/status`).set(h(ownerToken)).send({ status: 'CONFIRMED' });
  return order.id as string;
};

suite('Dispatch w/ cold-chain (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Dispatch Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Dispatch Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
    customerId = (await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'Cold Buyer' })).body.customer.id;

    // A frozen product lot from a processed batch (the traceable origin).
    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const batchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'DISP-BR', initialCount: 50 })).body
      .batch.id;
    const run = await request(app)
      .post('/api/farm/processing')
      .set(h(ownerToken))
      .send({ sourceBatchId: batchId, inputCount: 20, lots: [{ productName: 'Frozen chicken', state: 'FROZEN', quantityKg: 30 }] });
    frozenLotId = run.body.run.lots[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('blocks dispatch of a non-CONFIRMED (DRAFT) order', async () => {
    const draft = (
      await request(app)
        .post('/api/farm/orders')
        .set(h(ownerToken))
        .send({ customerId, lines: [{ description: 'x', qty: 1, unitPricePaise: 100 }] })
    ).body.order;
    const res = await request(app)
      .post('/api/farm/dispatches')
      .set(h(ownerToken))
      .send({ salesOrderId: draft.id, refrigeratedTransport: true, lines: [{ productLotId: frozenLotId, qtyKg: 1 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ORDER_NOT_CONFIRMED');
  });

  it('BLOCKS frozen dispatch without refrigerated transport (cold-chain gate)', async () => {
    const orderId = await confirmedOrder();
    const res = await request(app)
      .post('/api/farm/dispatches')
      .set(h(ownerToken))
      .send({ salesOrderId: orderId, refrigeratedTransport: false, lines: [{ productLotId: frozenLotId, qtyKg: 5 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('COLD_CHAIN_FAIL');
  });

  it('dispatches a confirmed order w/ cold-chain: decrements lot, marks order DISPATCHED, traces lot→batch', async () => {
    const orderId = await confirmedOrder();
    const res = await request(app)
      .post('/api/farm/dispatches')
      .set(h(ownerToken))
      .send({
        salesOrderId: orderId,
        refrigeratedTransport: true,
        dispatchTempC: -20,
        vehicleNumber: 'TS09AB1234',
        lines: [{ productLotId: frozenLotId, qtyKg: 10 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.dispatch.coldChainOk).toBe(true);
    // traceability: dispatch line → lot → source batch → species
    expect(res.body.dispatch.lines[0].productLot.sourceBatch.code).toBe('DISP-BR');
    expect(res.body.dispatch.lines[0].productLot.sourceBatch.species.name).toBeTruthy();

    // order moved to DISPATCHED
    const order = (await request(app).get(`/api/farm/orders/${orderId}`).set(h(ownerToken))).body.order;
    expect(order.status).toBe('DISPATCHED');

    // lot remaining decremented 30 → 20
    const lots = (await request(app).get('/api/farm/lots').set(h(ownerToken))).body.lots;
    const lot = lots.find((l: { id: string }) => l.id === frozenLotId);
    expect(lot.quantityKg).toBe('20');
  });

  it('LABOUR cannot dispatch (403)', async () => {
    const orderId = await confirmedOrder();
    const res = await request(app)
      .post('/api/farm/dispatches')
      .set(h(labourToken))
      .send({ salesOrderId: orderId, refrigeratedTransport: true, dispatchTempC: -20, lines: [{ productLotId: frozenLotId, qtyKg: 1 }] });
    expect(res.status).toBe(403);
  });
});
