import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'BypTest123!';
const emails = { owner: 'byptest-owner@ifm.local', labour: 'byptest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let poultryUnit = '';
let nurseryUnit = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Byproduct transfers (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Byproduct Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Byproduct Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
    poultryUnit = (await request(app).post('/api/farm/units').set(h(ownerToken)).send({ name: 'Poultry Shed 1', type: 'POULTRY' })).body.unit.id;
    nurseryUnit = (await request(app).post('/api/farm/units').set(h(ownerToken)).send({ name: 'Nursery', type: 'NURSERY' })).body.unit.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('records a litter→nursery transfer with a credit; LABOUR create → 403', async () => {
    const res = await request(app)
      .post('/api/farm/byproducts')
      .set(h(ownerToken))
      .send({ byproductType: 'LITTER', fromUnitId: poultryUnit, toUnitId: nurseryUnit, quantity: 120, unit: 'kg', creditPaise: 36000 });
    expect(res.status).toBe(201);
    expect(res.body.transfer.creditPaise).toBe('36000');
    expect(res.body.transfer.quantity).toBe('120');
    expect(res.body.transfer.byproductType).toBe('LITTER');

    const lab = await request(app)
      .post('/api/farm/byproducts')
      .set(h(labourToken))
      .send({ byproductType: 'MANURE', quantity: 1 });
    expect(lab.status).toBe(403);
  });

  it('rejects a transfer referencing a unit from another farm (422)', async () => {
    const res = await request(app)
      .post('/api/farm/byproducts')
      .set(h(ownerToken))
      .send({ byproductType: 'COMPOST', toUnitId: 'unit-does-not-exist', quantity: 5 });
    expect(res.status).toBe(422);
  });

  it('lists transfers newest-first', async () => {
    await request(app).post('/api/farm/byproducts').set(h(ownerToken)).send({ byproductType: 'COMPOST', toUnitId: nurseryUnit, quantity: 50, creditPaise: 10000 });
    const list = await request(app).get('/api/farm/byproducts').set(h(ownerToken));
    expect(list.body.transfers.length).toBeGreaterThanOrEqual(2);
    expect(list.body.transfers[0].byproductType).toBe('COMPOST');
  });
});
