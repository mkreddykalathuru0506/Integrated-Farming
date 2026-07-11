import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'PagTest123!';
const email = 'pagtest-owner@ifm.local';
let token = '';
let farmA = '';
let farmB = '';
let batch2 = '';

const hA = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });

/** Envelope shape assertions shared by all 12 endpoints. */
async function expectEnvelope(path: string, legacyKey: string, total: number) {
  const legacy = await request(app).get(path).set(hA());
  expect(legacy.status).toBe(200);
  expect(Array.isArray(legacy.body[legacyKey])).toBe(true);
  expect(legacy.body.items).toBeUndefined(); // legacy shape has no envelope keys

  const sep = path.includes('?') ? '&' : '?';
  const paged = await request(app).get(`${path}${sep}page=1&pageSize=2`).set(hA());
  expect(paged.status).toBe(200);
  expect(paged.body.total).toBe(total);
  expect(paged.body.page).toBe(1);
  expect(paged.body.pageSize).toBe(2);
  expect(paged.body.items.length).toBe(Math.min(2, total));

  // out-of-range page → empty items, real total (no error)
  const far = await request(app).get(`${path}${sep}page=99&pageSize=2`).set(hA());
  expect(far.status).toBe(200);
  expect(far.body.items).toEqual([]);
  expect(far.body.total).toBe(total);
}

suite('Additive pagination envelope (12 list endpoints)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: { in: ['PagList Farm A', 'PagList Farm B'] } } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken;
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'PagList Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'PagList Farm B' })).body.farm.id;

    const speciesA = (await request(app).get('/api/farm/species').set(hA())).body.species;
    const chickenA = speciesA.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const cattleA = speciesA.find((s: { code: string }) => s.code === 'CATTLE').id;
    const speciesB = (await request(app).get('/api/farm/species').set(hB())).body.species;
    const chickenB = speciesB.find((s: { code: string }) => s.code === 'CHICKEN').id;

    // --- farm A seed ---
    const unitA = (await request(app).post('/api/farm/units').set(hA()).send({ name: 'Pag Shed A', type: 'POULTRY' })).body.unit.id;
    const unitN = (await request(app).post('/api/farm/units').set(hA()).send({ name: 'Pag Nursery', type: 'OTHER' })).body.unit.id;

    await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chickenA, code: 'PGA-B1', name: 'Alpha One', initialCount: 100 });
    batch2 = (await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chickenA, code: 'PGA-B2', initialCount: 50 })).body.batch.id;
    const b3 = (await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chickenA, code: 'PGA-B3', initialCount: 20 })).body.batch.id;
    await request(app).post(`/api/farm/batches/${b3}/close`).set(hA());

    await request(app).post('/api/farm/animals').set(hA()).send({ speciesId: cattleA, tagNumber: 'PGA-C1', name: 'Lakshmi' });
    await request(app).post('/api/farm/animals').set(hA()).send({ speciesId: cattleA, tagNumber: 'PGA-C2' });
    const c3 = (await request(app).post('/api/farm/animals').set(hA()).send({ speciesId: cattleA, tagNumber: 'PGA-C3' })).body.animal.id;
    await request(app).post('/api/farm/mortality').set(hA()).send({ animalId: c3, type: 'CULL', cause: 'age' });

    await request(app).post('/api/farm/workers').set(hA()).send({ name: 'Pag Ravi', phone: '9000000001' });
    const w2 = (await request(app).post('/api/farm/workers').set(hA()).send({ name: 'Pag Suresh' })).body.worker.id;
    await request(app).patch(`/api/farm/workers/${w2}`).set(hA()).send({ isActive: false });

    const custA = (
      await request(app).post('/api/farm/customers').set(hA()).send({ name: 'Pag Acme Traders', gstin: '36AAAPL1234C1ZV', phone: '9000000009', state: 'Telangana' })
    ).body.customer.id;
    await request(app).post('/api/farm/customers').set(hA()).send({ name: 'Pag Zen Foods' });

    await request(app).post('/api/farm/logs').set(hA()).send({ type: 'FEED', batchId: batch2, quantity: 10, unit: 'kg', loggedAt: '2026-06-01T06:00:00.000Z' });
    await request(app).post('/api/farm/logs').set(hA()).send({ type: 'FEED', unitId: unitA, quantity: 12, unit: 'kg', loggedAt: '2026-06-02T06:00:00.000Z' });
    await request(app).post('/api/farm/logs').set(hA()).send({ type: 'EGGS', unitId: unitA, quantity: 30, unit: 'unit', loggedAt: '2026-06-03T06:00:00.000Z' });

    await request(app).post('/api/farm/expenses').set(hA()).send({ category: 'FEED', amountPaise: 10000, description: 'starter feed', occurredAt: '2026-06-01T10:00:00.000Z' });
    await request(app).post('/api/farm/expenses').set(hA()).send({ category: 'UTILITIES', amountPaise: 5000, description: 'diesel top-up', occurredAt: '2026-06-05T10:00:00.000Z' });
    await request(app).post('/api/farm/expenses').set(hA()).send({ category: 'MEDICINE', amountPaise: 3000, occurredAt: '2026-06-10T10:00:00.000Z' });

    await request(app).post('/api/farm/invoices').set(hA()).send({
      customerId: custA,
      issueDate: '2026-05-01T10:00:00.000Z',
      lines: [{ description: 'Broiler', qty: 10, unitPricePaise: 20000, gstRateBps: 0 }],
    });
    await request(app).post('/api/farm/invoices').set(hA()).send({
      customerId: custA,
      issueDate: '2026-06-01T10:00:00.000Z',
      lines: [{ description: 'Eggs', qty: 30, unitPricePaise: 600, gstRateBps: 0 }],
    });

    await request(app).post('/api/farm/orders').set(hA()).send({ customerId: custA, lines: [{ description: 'Broiler', qty: 5, unitPricePaise: 20000 }] });
    await request(app).post('/api/farm/orders').set(hA()).send({ customerId: custA, lines: [{ description: 'Eggs', qty: 10, unitPricePaise: 600 }] });

    await request(app).post('/api/farm/market').set(hA()).send({ commodity: 'Broiler', pricePaise: 10000, unit: 'kg', observedAt: '2026-06-01T09:00:00.000Z' });
    await request(app).post('/api/farm/market').set(hA()).send({ commodity: 'Broiler', pricePaise: 9700, unit: 'kg', observedAt: '2026-06-02T09:00:00.000Z' });
    await request(app).post('/api/farm/market').set(hA()).send({ commodity: 'Egg', pricePaise: 600, unit: 'dozen', observedAt: '2026-06-02T09:00:00.000Z' });

    await prisma.notificationLog.createMany({
      data: [
        { farmId: farmA, channel: 'SMS', recipient: 'owner', subject: 'HEAT_STRESS', body: 'hot', status: 'MOCKED' },
        { farmId: farmA, channel: 'SMS', recipient: 'owner', subject: 'PRICE_DROP', body: 'drop', status: 'FAILED' },
      ],
    });

    await request(app).post('/api/farm/byproducts').set(hA()).send({ byproductType: 'LITTER', fromUnitId: unitA, toUnitId: unitN, quantity: 100, notes: 'to nursery' });
    await request(app).post('/api/farm/byproducts').set(hA()).send({ byproductType: 'COMPOST', fromUnitId: unitN, toUnitId: unitA, quantity: 50 });

    await request(app).post('/api/farm/assets').set(hA()).send({ name: 'Pag Genset', code: 'GEN-1' });
    await request(app).post('/api/farm/assets').set(hA()).send({ name: 'Pag Pump' });

    // --- farm B seed: one near-identical row per entity (IDOR bait) ---
    const unitB = (await request(app).post('/api/farm/units').set(hB()).send({ name: 'Pag Shed B', type: 'POULTRY' })).body.unit.id;
    await request(app).post('/api/farm/batches').set(hB()).send({ speciesId: chickenB, code: 'PGB-B1', name: 'Alpha Beta', initialCount: 10 });
    await request(app).post('/api/farm/workers').set(hB()).send({ name: 'Pag Ravi' });
    const custB = (await request(app).post('/api/farm/customers').set(hB()).send({ name: 'Pag Acme Traders' })).body.customer.id;
    await request(app).post('/api/farm/logs').set(hB()).send({ type: 'FEED', unitId: unitB, quantity: 1, unit: 'kg' });
    await request(app).post('/api/farm/expenses').set(hB()).send({ category: 'UTILITIES', amountPaise: 100, description: 'diesel spare' });
    await request(app).post('/api/farm/invoices').set(hB()).send({ customerId: custB, lines: [{ description: 'X', qty: 1, unitPricePaise: 100, gstRateBps: 0 }] });
    await request(app).post('/api/farm/orders').set(hB()).send({ customerId: custB, lines: [{ description: 'X', qty: 1, unitPricePaise: 100 }] });
    await request(app).post('/api/farm/market').set(hB()).send({ commodity: 'Broiler', pricePaise: 8000, unit: 'kg' });
    await prisma.notificationLog.create({
      data: { farmId: farmB, channel: 'SMS', recipient: 'owner', subject: 'HEAT_STRESS', body: 'hot B', status: 'MOCKED' },
    });
    await request(app).post('/api/farm/byproducts').set(hB()).send({ byproductType: 'LITTER', fromUnitId: unitB, quantity: 5, notes: 'to nursery too' });
    await request(app).post('/api/farm/assets').set(hB()).send({ name: 'Pag Genset' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('batches: legacy shape, envelope, q, status, from/to, farm-scoped', async () => {
    await expectEnvelope('/api/farm/batches', 'batches', 3);
    // paged items carry the same DTO as the legacy elements (match by id — order-safe)
    const legacy = await request(app).get('/api/farm/batches').set(hA());
    const paged = await request(app).get('/api/farm/batches?page=1&pageSize=2').set(hA());
    const twin = legacy.body.batches.find((b: { id: string }) => b.id === paged.body.items[0].id);
    expect(paged.body.items[0]).toEqual(twin);

    const q = await request(app).get('/api/farm/batches?q=alpha').set(hA());
    expect(q.body.batches).toHaveLength(1); // farm B's "Alpha Beta" not visible
    expect(q.body.batches[0].code).toBe('PGA-B1');

    const closed = await request(app).get('/api/farm/batches?status=CLOSED').set(hA());
    expect(closed.body.batches).toHaveLength(1);
    const bad = await request(app).get('/api/farm/batches?status=BOGUS').set(hA());
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION');

    const none = await request(app).get('/api/farm/batches?from=2099-01-01').set(hA());
    expect(none.body.batches).toHaveLength(0);
  });

  it('animals: legacy shape, envelope, q, status', async () => {
    await expectEnvelope('/api/farm/animals', 'animals', 3);
    const q = await request(app).get('/api/farm/animals?q=PGA-C&page=1&pageSize=50').set(hA());
    expect(q.body.total).toBe(3);
    const culled = await request(app).get('/api/farm/animals?status=CULLED').set(hA());
    expect(culled.body.animals).toHaveLength(1);
    expect((await request(app).get('/api/farm/animals?status=NOPE').set(hA())).status).toBe(400);
  });

  it('workers: legacy shape, envelope, q, active flag', async () => {
    await expectEnvelope('/api/farm/workers', 'workers', 2);
    const q = await request(app).get('/api/farm/workers?q=Ravi').set(hA());
    expect(q.body.workers).toHaveLength(1); // farm B's Pag Ravi not visible
    const inactive = await request(app).get('/api/farm/workers?active=false').set(hA());
    expect(inactive.body.workers.map((w: { name: string }) => w.name)).toEqual(['Pag Suresh']);
    expect((await request(app).get('/api/farm/workers?active=maybe').set(hA())).status).toBe(400);
  });

  it('customers: legacy shape, envelope, q farm-scoped', async () => {
    await expectEnvelope('/api/farm/customers', 'customers', 2);
    const q = await request(app).get('/api/farm/customers?q=acme&page=1&pageSize=10').set(hA());
    expect(q.body.total).toBe(1);
    expect(q.body.items[0].name).toBe('Pag Acme Traders');
  });

  it('logs: legacy shape, envelope, type + batchId filters, from/to', async () => {
    await expectEnvelope('/api/farm/logs', 'logs', 3);
    const feed = await request(app).get('/api/farm/logs?type=FEED').set(hA());
    expect(feed.body.logs).toHaveLength(2);
    const byBatch = await request(app).get(`/api/farm/logs?batchId=${batch2}`).set(hA());
    expect(byBatch.body.logs).toHaveLength(1);
    const window = await request(app).get('/api/farm/logs?from=2026-06-02T00:00:00.000Z&to=2026-06-02T23:59:59.000Z').set(hA());
    expect(window.body.logs).toHaveLength(1);
    expect((await request(app).get('/api/farm/logs?type=NOPE').set(hA())).status).toBe(400);
  });

  it('expenses: legacy shape, envelope, q, status(category), legacy category kept, from/to', async () => {
    await expectEnvelope('/api/farm/expenses', 'expenses', 3);
    const q = await request(app).get('/api/farm/expenses?q=diesel&page=1&pageSize=10').set(hA());
    expect(q.body.total).toBe(1); // farm B's "diesel spare" not visible
    expect(q.body.items[0].amountPaise).toBe('5000'); // paise stays string in the envelope
    const st = await request(app).get('/api/farm/expenses?status=FEED').set(hA());
    expect(st.body.expenses).toHaveLength(1);
    const legacyCat = await request(app).get('/api/farm/expenses?category=FEED').set(hA());
    expect(legacyCat.body.expenses).toHaveLength(1);
    const window = await request(app).get('/api/farm/expenses?from=2026-06-03T00:00:00.000Z&to=2026-06-07T00:00:00.000Z').set(hA());
    expect(window.body.expenses).toHaveLength(1);
    expect((await request(app).get('/api/farm/expenses?status=NOPE').set(hA())).status).toBe(400);
  });

  it('invoices: legacy DTO untouched; paged adds customer {id,name}; q, status, issueDate window', async () => {
    await expectEnvelope('/api/farm/invoices', 'invoices', 2);
    const legacy = await request(app).get('/api/farm/invoices').set(hA());
    expect(legacy.body.invoices[0].customer).toBeUndefined(); // legacy DTO has no customer join
    expect(legacy.body.invoices[0].totalPaise).toMatch(/^\d+$/);

    const paged = await request(app).get('/api/farm/invoices?page=1&pageSize=10').set(hA());
    expect(paged.body.items[0].customer).toEqual({ id: expect.any(String), name: 'Pag Acme Traders' });

    const q = await request(app).get('/api/farm/invoices?q=acme&page=1&pageSize=10').set(hA());
    expect(q.body.total).toBe(2); // farm B's invoice for its own "Pag Acme Traders" not visible
    const paid = await request(app).get('/api/farm/invoices?status=PAID').set(hA());
    expect(paid.body.invoices).toHaveLength(0);
    const window = await request(app).get('/api/farm/invoices?from=2026-05-15T00:00:00.000Z').set(hA());
    expect(window.body.invoices).toHaveLength(1);
    expect((await request(app).get('/api/farm/invoices?status=NOPE').set(hA())).status).toBe(400);
  });

  it('orders: legacy shape, envelope, q + status', async () => {
    await expectEnvelope('/api/farm/orders', 'orders', 2);
    const q = await request(app).get('/api/farm/orders?q=acme&status=DRAFT&page=1&pageSize=10').set(hA());
    expect(q.body.total).toBe(2);
    expect((await request(app).get('/api/farm/orders?status=NOPE').set(hA())).status).toBe(400);
  });

  it('market: legacy stays latest-per-commodity; paged returns raw observations', async () => {
    const legacy = await request(app).get('/api/farm/market').set(hA());
    expect(legacy.body.rates).toHaveLength(2); // Broiler + Egg, latest each
    const paged = await request(app).get('/api/farm/market?page=1&pageSize=10').set(hA());
    expect(paged.body.total).toBe(3); // raw observations
    expect(paged.body.items[0].pricePaise).toMatch(/^\d+$/);
    const q = await request(app).get('/api/farm/market?q=Broi&page=1&pageSize=10').set(hA());
    expect(q.body.total).toBe(2); // farm B's Broiler rate not visible
  });

  it('alerts: legacy shape, envelope, q + status', async () => {
    await expectEnvelope('/api/farm/alerts', 'alerts', 2);
    const q = await request(app).get('/api/farm/alerts?q=HEAT').set(hA());
    expect(q.body.alerts).toHaveLength(1); // farm B's HEAT_STRESS alert not visible
    const failed = await request(app).get('/api/farm/alerts?status=FAILED').set(hA());
    expect(failed.body.alerts).toHaveLength(1);
    expect((await request(app).get('/api/farm/alerts?status=NOPE').set(hA())).status).toBe(400);
  });

  it('byproducts: legacy shape, envelope, q + type', async () => {
    await expectEnvelope('/api/farm/byproducts', 'transfers', 2);
    const q = await request(app).get('/api/farm/byproducts?q=nursery').set(hA());
    expect(q.body.transfers).toHaveLength(1); // farm B's "to nursery too" not visible
    const litter = await request(app).get('/api/farm/byproducts?type=LITTER').set(hA());
    expect(litter.body.transfers).toHaveLength(1);
    expect(litter.body.transfers[0].creditPaise).toMatch(/^\d+$/);
    expect((await request(app).get('/api/farm/byproducts?type=NOPE').set(hA())).status).toBe(400);
  });

  it('assets: legacy shape, envelope, q + status; schedules sub-select kept', async () => {
    await expectEnvelope('/api/farm/assets', 'assets', 2);
    const q = await request(app).get('/api/farm/assets?q=Genset&page=1&pageSize=10').set(hA());
    expect(q.body.total).toBe(1); // farm B's Pag Genset not visible
    expect(q.body.items[0].schedules).toEqual([]);
    const active = await request(app).get('/api/farm/assets?status=ACTIVE').set(hA());
    expect(active.body.assets).toHaveLength(2);
    expect((await request(app).get('/api/farm/assets?status=NOPE').set(hA())).status).toBe(400);
  });

  it('pageSize is capped at 100 and page must be >= 1', async () => {
    expect((await request(app).get('/api/farm/batches?page=1&pageSize=101').set(hA())).status).toBe(400);
    expect((await request(app).get('/api/farm/batches?page=0').set(hA())).status).toBe(400);
    expect((await request(app).get('/api/farm/batches?from=not-a-date').set(hA())).status).toBe(400);
  });
});
