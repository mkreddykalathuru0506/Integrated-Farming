import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'HatchTest123!';
const emails = { owner: 'hatchtest-owner@ifm.local', labour: 'hatchtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let chickenId = '';
let cattleId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });
const dayDiff = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

suite('Hatchery + incubation (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Hatch Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Hatch Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    cattleId = sp.find((s: { code: string }) => s.code === 'CATTLE').id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  let batchId = '';
  it('sets a chicken hatchery batch with a 21-day incubation timeline', async () => {
    const setDate = '2026-06-01T00:00:00.000Z';
    const res = await request(app).post('/api/farm/hatchery').set(h(ownerToken)).send({ speciesId: chickenId, code: 'HCH-1', setDate, eggCount: 100 });
    expect(res.status).toBe(201);
    expect(res.body.batch.incubationDays).toBe(21);
    expect(dayDiff(res.body.batch.expectedHatchDate, setDate)).toBe(21);
    expect(dayDiff(res.body.batch.candlingDate, setDate)).toBe(7);
    expect(dayDiff(res.body.batch.lockdownDate, setDate)).toBe(18);
    batchId = res.body.batch.id;
  });

  it('rejects a species without an incubation period (422)', async () => {
    const res = await request(app).post('/api/farm/hatchery').set(h(ownerToken)).send({ speciesId: cattleId, code: 'HCH-COW', setDate: '2026-06-01T00:00:00.000Z', eggCount: 10 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NO_INCUBATION_DAYS');
  });

  it('adds an incubation log and records hatch with rates', async () => {
    const log = await request(app).post(`/api/farm/hatchery/${batchId}/logs`).set(h(ownerToken)).send({ event: 'TEMP_LOG', temperatureC: 37.7, humidityPct: 55 });
    expect(log.status).toBe(201);

    const upd = await request(app).patch(`/api/farm/hatchery/${batchId}`).set(h(ownerToken)).send({ status: 'HATCHED', hatchedCount: 80, fertileCount: 90 });
    expect(upd.status).toBe(200);
    expect(upd.body.batch.hatchRate).toBe(80);
    expect(upd.body.batch.fertilityRate).toBe(90);
  });

  it('LABOUR cannot set a hatchery batch (403)', async () => {
    const res = await request(app).post('/api/farm/hatchery').set(h(labourToken)).send({ speciesId: chickenId, code: 'HCH-2', setDate: '2026-06-01T00:00:00.000Z', eggCount: 50 });
    expect(res.status).toBe(403);
  });
});
