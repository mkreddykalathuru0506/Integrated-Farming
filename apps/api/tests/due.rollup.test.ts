import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'DueTest123!';
const emails = { owner: 'duetest-owner@ifm.local', labour: 'duetest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farmA = '';
let farmB = '';
let batchId = '';

const hA = (t = token) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });
const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

suite('GET /api/farm/due — farm-wide rollup (slice 11.5a)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Due Farm A', 'Due Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.owner);
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Due Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Due Farm B' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    // Vaccinations: chicken batch acquired 10 days ago → Marek's (1d) + NDV F1 (7d) due
    const sp = (await request(app).get('/api/farm/species').set(hA())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (
      await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chicken, code: 'DUE-B1', initialCount: 100, acquiredAt: inDays(-10) })
    ).body.batch.id;

    // Maintenance: schedule due in 3 days
    const asset = (await request(app).post('/api/farm/assets').set(hA()).send({ name: 'Due Genset' })).body.asset.id;
    await request(app).post(`/api/farm/assets/${asset}/schedules`).set(hA()).send({ name: 'Oil change', intervalDays: 90, nextDueDate: inDays(3) });

    // Finance: EMI due in 3 days; policy expiring in 10 days
    await request(app).post('/api/farm/loans').set(hA()).send({ lender: 'Due Bank', principalPaise: 10000000, emiAmountPaise: 250000, startDate: inDays(-60), nextDueDate: inDays(3) });
    await request(app).post('/api/farm/insurance').set(hA()).send({ provider: 'Due Insure', type: 'LIVESTOCK', premiumPaise: 100000, startDate: inDays(-300), endDate: inDays(10) });

    // Tasks: one PENDING today (IST)
    await request(app).post('/api/farm/tasks').set(hA()).send({ title: 'Feed shed A', taskType: 'FEEDING', dueDate: istToday() });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('composes vaccinations, maintenance, finance and tasks; counts match arrays', async () => {
    const res = await request(app).get('/api/farm/due').set(hA());
    expect(res.status).toBe(200);
    const b = res.body;
    expect(b.days).toBe(7);

    expect(b.vaccinations).toHaveLength(1);
    expect(b.vaccinations[0].batch).toEqual({ id: batchId, code: 'DUE-B1' });
    expect(b.vaccinations[0].due.map((d: { vaccineName: string }) => d.vaccineName)).toEqual(["Marek's", 'Ranikhet (NDV) F1']);

    expect(b.maintenance).toHaveLength(1);
    expect(b.maintenance[0].name).toBe('Oil change');
    expect(b.maintenance[0].asset.name).toBe('Due Genset');

    expect(b.emiDue).toHaveLength(1);
    expect(b.emiDue[0].emiAmountPaise).toBe('250000'); // paise stays string
    expect(b.policiesExpiring).toHaveLength(1);

    expect(b.tasksToday).toHaveLength(1);
    expect(b.tasksToday[0].status).toBe('PENDING');

    expect(b.counts).toEqual({ vaccinations: 2, maintenance: 1, emi: 1, insurance: 1, tasks: 1 });
  });

  it('recording a vaccination shrinks the due list (composition, not duplication)', async () => {
    await request(app).post('/api/farm/health/vaccinations').set(hA()).send({ batchId, vaccineName: "Marek's" });
    const res = await request(app).get('/api/farm/due').set(hA());
    expect(res.body.counts.vaccinations).toBe(1);
    expect(res.body.vaccinations[0].due.map((d: { vaccineName: string }) => d.vaccineName)).toEqual(['Ranikhet (NDV) F1']);
  });

  it('days is validated and drives the maintenance window', async () => {
    const short = await request(app).get('/api/farm/due?days=1').set(hA());
    expect(short.body.days).toBe(1);
    expect(short.body.counts.maintenance).toBe(0); // schedule is 3 days out
    expect((await request(app).get('/api/farm/due?days=0').set(hA())).status).toBe(400);
    expect((await request(app).get('/api/farm/due?days=61').set(hA())).status).toBe(400);
  });

  it('LABOUR can read; empty farm returns all-zero counts (no error)', async () => {
    const labour = await request(app).get('/api/farm/due').set(hA(labourToken));
    expect(labour.status).toBe(200);

    const empty = await request(app).get('/api/farm/due').set(hB());
    expect(empty.status).toBe(200);
    expect(empty.body.counts).toEqual({ vaccinations: 0, maintenance: 0, emi: 0, insurance: 0, tasks: 0 });
    expect(empty.body.vaccinations).toEqual([]);
    expect(empty.body.tasksToday).toEqual([]);
  });
});
