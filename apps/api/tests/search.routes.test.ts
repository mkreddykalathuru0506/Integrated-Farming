import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'SearchTest123!';
const emails = {
  ownerA: 'searchtest-owner-a@ifm.local',
  ownerB: 'searchtest-owner-b@ifm.local',
  labour: 'searchtest-labour@ifm.local',
  susp: 'searchtest-susp@ifm.local',
};
const TOKEN = 'ZEBRAQX'; // shared search token, unique to this file
let ownerAToken = '';
let ownerBToken = '';
let labourToken = '';
let suspToken = '';
let farmA = '';
let farmB = '';
let seededIds: string[] = []; // every farm-A entity id seeded with TOKEN

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, farm: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

type Group = { type: string; route: { section: string; panel: string }; items: Record<string, unknown>[] };
const groupOf = (body: { groups: Group[] }, type: string) => body.groups.find((g) => g.type === type);

suite('Global search (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Search Farm A', 'Search Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerAToken = await login(emails.ownerA);
    ownerBToken = await login(emails.ownerB);
    farmA = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerAToken}`).send({ name: 'Search Farm A' })
    ).body.farm.id;
    farmB = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerBToken}`).send({ name: 'Search Farm B' })
    ).body.farm.id;

    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
    const susp = await prisma.user.findUniqueOrThrow({ where: { email: emails.susp } });
    await prisma.membership.create({ data: { userId: susp.id, farmId: farmA, role: 'MANAGER', status: 'SUSPENDED' } });
    suspToken = await login(emails.susp);

    // Seed one of each of the 8 searchable entities on farm A, all carrying TOKEN.
    const speciesA = (await request(app).get('/api/farm/species').set(h(ownerAToken, farmA))).body.species;
    const chickenA = speciesA.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const cattleA = speciesA.find((s: { code: string }) => s.code === 'CATTLE').id;

    const batch = await prisma.batch.create({
      data: { farmId: farmA, speciesId: chickenA, code: `${TOKEN}-B1`, initialCount: 100, currentCount: 100 },
    });
    const animal = await prisma.animal.create({
      data: { farmId: farmA, speciesId: cattleA, tagNumber: `${TOKEN}-A1`, name: 'Gauri' },
    });
    const customer = await prisma.customer.create({ data: { farmId: farmA, name: `${TOKEN} Traders`, phone: '9000000001' } });
    const vendor = await prisma.vendor.create({ data: { farmId: farmA, name: `${TOKEN} Feeds`, phone: '9000000002' } });
    const invoice = await prisma.invoice.create({
      data: {
        farmId: farmA,
        invoiceNumber: `INV-${TOKEN}-0001`,
        customerId: customer.id,
        subtotalPaise: 100000n,
        cgstPaise: 2500n,
        sgstPaise: 2500n,
        igstPaise: 0n,
        totalPaise: 105000n,
      },
    });
    const lot = await prisma.productLot.create({
      data: { farmId: farmA, lotCode: `IFM-L-${TOKEN}`, productName: 'Chicken curry cut', initialQuantityKg: 10, quantityKg: 10 },
    });
    const worker = await prisma.worker.create({ data: { farmId: farmA, name: `${TOKEN} Kumar`, designation: 'Supervisor' } });
    const order = await prisma.salesOrder.create({
      data: { farmId: farmA, orderNumber: `SO-${TOKEN}-0001`, customerId: customer.id, totalPaise: 250000n },
    });
    seededIds = [batch.id, animal.id, customer.id, vendor.id, invoice.id, lot.id, worker.id, order.id];

    // Identically-named decoys on farm B — must NEVER surface in farm A's results.
    const speciesB = (await request(app).get('/api/farm/species').set(h(ownerBToken, farmB))).body.species;
    const chickenB = speciesB.find((s: { code: string }) => s.code === 'CHICKEN').id;
    await prisma.batch.create({
      data: { farmId: farmB, speciesId: chickenB, code: `${TOKEN}-B1`, initialCount: 5, currentCount: 5 },
    });
    await prisma.customer.create({ data: { farmId: farmB, name: `${TOKEN} Traders`, phone: '9000000001' } });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA, farmB] } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('rejects a missing or too-short q with 400 VALIDATION', async () => {
    const missing = await request(app).get('/api/farm/search').set(h(ownerAToken, farmA));
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION');

    const short = await request(app).get('/api/farm/search').query({ q: 'a' }).set(h(ownerAToken, farmA));
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe('VALIDATION');

    const padded = await request(app).get('/api/farm/search').query({ q: ' a ' }).set(h(ownerAToken, farmA));
    expect(padded.status).toBe(400); // trimmed before min-length check
  });

  it('finds every entity type, case-insensitively, with typed DTOs + route hints', async () => {
    const res = await request(app)
      .get('/api/farm/search')
      .query({ q: TOKEN.toLowerCase() }) // lowercase query vs upper-case seeds
      .set(h(ownerAToken, farmA));
    expect(res.status).toBe(200);
    expect(res.body.q).toBe(TOKEN.toLowerCase());

    const types = (res.body.groups as Group[]).map((g) => g.type).sort();
    expect(types).toEqual(['animal', 'batch', 'customer', 'invoice', 'lot', 'order', 'vendor', 'worker']);
    expect(res.body.total).toBe(8);

    const batch = groupOf(res.body, 'batch')!;
    expect(batch.route).toEqual({ section: 'livestock', panel: 'batches' });
    expect(batch.items[0]).toMatchObject({ code: `${TOKEN}-B1`, status: 'ACTIVE' });

    const animal = groupOf(res.body, 'animal')!;
    expect(animal.route).toEqual({ section: 'livestock', panel: 'animals' });
    expect(animal.items[0]).toMatchObject({ tagNumber: `${TOKEN}-A1` });

    expect(groupOf(res.body, 'customer')!.route).toEqual({ section: 'finance', panel: 'invoices' });
    expect(groupOf(res.body, 'vendor')!.route).toEqual({ section: 'finance', panel: 'feed' });
    expect(groupOf(res.body, 'lot')!.route).toEqual({ section: 'sales', panel: 'processing' });
    expect(groupOf(res.body, 'worker')!.route).toEqual({ section: 'daily', panel: 'workers' });
    expect(groupOf(res.body, 'worker')!.items[0]).toMatchObject({ designation: 'Supervisor' });

    // BigInt paise serialized as strings (house rule).
    const invoice = groupOf(res.body, 'invoice')!;
    expect(invoice.route).toEqual({ section: 'finance', panel: 'invoices' });
    expect(invoice.items[0]).toMatchObject({ invoiceNumber: `INV-${TOKEN}-0001`, totalPaise: '105000' });
    const order = groupOf(res.body, 'order')!;
    expect(order.route).toEqual({ section: 'sales', panel: 'orders' });
    expect(order.items[0]).toMatchObject({ orderNumber: `SO-${TOKEN}-0001`, totalPaise: '250000' });

    // Farm-scoping / no IDOR: every returned id is a farm-A seed (farm B decoys absent).
    for (const g of res.body.groups as Group[]) {
      for (const item of g.items) expect(seededIds).toContain(item.id);
    }
  });

  it('matches partial tokens (invoice number prefix)', async () => {
    const res = await request(app).get('/api/farm/search').query({ q: `inv-${TOKEN}` }).set(h(ownerAToken, farmA));
    expect(res.status).toBe(200);
    expect(groupOf(res.body, 'invoice')!.items).toHaveLength(1);
  });

  it('caps each type at 5 hits', async () => {
    const speciesA = (await request(app).get('/api/farm/species').set(h(ownerAToken, farmA))).body.species;
    const chickenA = speciesA.find((s: { code: string }) => s.code === 'CHICKEN').id;
    for (let i = 1; i <= 7; i++) {
      await prisma.batch.create({
        data: { farmId: farmA, speciesId: chickenA, code: `LIMITQX-${i}`, initialCount: 10, currentCount: 10 },
      });
    }
    const res = await request(app).get('/api/farm/search').query({ q: 'limitqx' }).set(h(ownerAToken, farmA));
    expect(res.status).toBe(200);
    expect(groupOf(res.body, 'batch')!.items).toHaveLength(5);
    expect(res.body.total).toBe(5);
  });

  it('excludes soft-deleted rows and omits empty groups', async () => {
    await prisma.customer.create({ data: { farmId: farmA, name: 'DELQX Gone Traders', deletedAt: new Date() } });
    const res = await request(app).get('/api/farm/search').query({ q: 'delqx' }).set(h(ownerAToken, farmA));
    expect(res.status).toBe(200);
    expect(res.body.groups).toEqual([]); // deleted row filtered out; empty groups omitted
    expect(res.body.total).toBe(0);
  });

  it('is readable by any ACTIVE member (LABOUR), but not suspended / cross-farm / anonymous', async () => {
    const labour = await request(app).get('/api/farm/search').query({ q: TOKEN }).set(h(labourToken, farmA));
    expect(labour.status).toBe(200);
    expect(labour.body.total).toBe(8);

    const susp = await request(app).get('/api/farm/search').query({ q: TOKEN }).set(h(suspToken, farmA));
    expect(susp.status).toBe(403);

    const crossFarm = await request(app).get('/api/farm/search').query({ q: TOKEN }).set(h(ownerAToken, farmB));
    expect(crossFarm.status).toBe(403); // owner A has no membership on farm B

    const anon = await request(app).get('/api/farm/search').query({ q: TOKEN });
    expect(anon.status).toBe(401);
  });

  it("scopes farm B's results to farm B (decoys only)", async () => {
    const res = await request(app).get('/api/farm/search').query({ q: TOKEN }).set(h(ownerBToken, farmB));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // the batch + customer decoys, nothing from farm A
    for (const g of res.body.groups as Group[]) {
      for (const item of g.items) expect(seededIds).not.toContain(item.id);
    }
  });
});
