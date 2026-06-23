import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'HealthTest123!';
const emails = {
  owner: 'healthtest-owner@ifm.local',
  vet: 'healthtest-vet@ifm.local',
  labour: 'healthtest-labour@ifm.local',
};
let ownerToken = '';
let vetToken = '';
let labourToken = '';
let farm = '';
let batchActive = '';
let batchClear = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Health + withdrawal gate (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Health Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Health Farm' })).body.farm.id;
    const vet = await prisma.user.findUniqueOrThrow({ where: { email: emails.vet } });
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: vet.id, farmId: farm, role: 'VETERINARIAN' } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    vetToken = await login(emails.vet);
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchActive = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'HB-ACT', initialCount: 50 })).body.batch.id;
    batchClear = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'HB-CLR', initialCount: 50 })).body.batch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
    await prisma.$disconnect();
  });

  it('VET records a health record', async () => {
    const res = await request(app).post('/api/farm/health/records').set(h(vetToken)).send({ batchId: batchActive, type: 'CHECKUP', description: 'Routine' });
    expect(res.status).toBe(201);
  });

  it('an active medication blocks sale-ready (422 WITHDRAWAL_ACTIVE)', async () => {
    const med = await request(app).post('/api/farm/health/medications').set(h(vetToken)).send({ batchId: batchActive, drugName: 'Enrofloxacin', withdrawalDays: 7 });
    expect(med.status).toBe(201);

    const status = await request(app).get(`/api/farm/health/withdrawal?batchId=${batchActive}`).set(h(ownerToken));
    expect(status.body.underWithdrawal).toBe(true);

    const sale = await request(app).post('/api/farm/health/sale-ready').set(h(ownerToken)).send({ batchId: batchActive });
    expect(sale.status).toBe(422);
    expect(sale.body.error.code).toBe('WITHDRAWAL_ACTIVE');
  });

  it('an elapsed medication does not block sale-ready (200)', async () => {
    const med = await request(app).post('/api/farm/health/medications').set(h(vetToken)).send({
      batchId: batchClear,
      drugName: 'OldDrug',
      withdrawalDays: 1,
      administeredAt: '2020-01-01T00:00:00.000Z',
    });
    expect(med.status).toBe(201);

    const sale = await request(app).post('/api/farm/health/sale-ready').set(h(ownerToken)).send({ batchId: batchClear });
    expect(sale.status).toBe(200);
    expect(sale.body.result.saleReadyAt).toBeTruthy();
  });

  it('LABOUR cannot record a medication (403)', async () => {
    const res = await request(app).post('/api/farm/health/medications').set(h(labourToken)).send({ batchId: batchActive, drugName: 'X', withdrawalDays: 3 });
    expect(res.status).toBe(403);
  });
});
