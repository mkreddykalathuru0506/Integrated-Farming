import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'OnboardTest123!';
const emails = { owner: 'onboard-owner@ifm.local', labour: 'onboard-labour@ifm.local' };
let token = '';
let labourToken = '';
let farmA = '';
let farmB = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const hA = (t = token) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });

suite('GET /api/farm/onboarding (slice 11.7)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Onboard Farm A', 'Onboard Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.owner);
    farmA = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Onboard Farm A' })
    ).body.farm.id;
    farmB = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Onboard Farm B' })
    ).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('fresh farm → every step pending, 0/5', async () => {
    const res = await request(app).get('/api/farm/onboarding').set(hA());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      steps: {
        units: { done: false },
        batches: { done: false },
        workers: { done: false },
        dailyLogs: { done: false },
        invoices: { done: false },
      },
      completedCount: 0,
      total: 5,
    });
  });

  it('any member can read it (LABOUR → 200)', async () => {
    const res = await request(app).get('/api/farm/onboarding').set(hA(labourToken));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
  });

  it('seeded farm flips its steps; counts stay farm-scoped', async () => {
    // Seed farm B only: unit + batch + worker.
    const unit = (await request(app).post('/api/farm/units').set(hB()).send({ name: 'OB Shed', type: 'POULTRY' }))
      .body.unit.id;
    const sp = (await request(app).get('/api/farm/species').set(hB())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    await request(app)
      .post('/api/farm/batches')
      .set(hB())
      .send({ speciesId: chicken, code: 'OB-B1', initialCount: 10, unitId: unit });
    await request(app).post('/api/farm/workers').set(hB()).send({ name: 'OB Worker' });

    const b = await request(app).get('/api/farm/onboarding').set(hB());
    expect(b.body.steps).toMatchObject({
      units: { done: true },
      batches: { done: true },
      workers: { done: true },
      dailyLogs: { done: false },
      invoices: { done: false },
    });
    expect(b.body.completedCount).toBe(3);

    // Farm A is untouched by farm B's data (no cross-farm leak).
    const a = await request(app).get('/api/farm/onboarding').set(hA());
    expect(a.body.completedCount).toBe(0);
  });
});
