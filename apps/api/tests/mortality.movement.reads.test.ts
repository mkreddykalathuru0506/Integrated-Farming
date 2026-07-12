import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'MMRead123!';
const emails = { owner: 'mmread-owner@ifm.local', labour: 'mmread-labour@ifm.local' };
let token = '';
let labourToken = '';
let farmA = '';
let farmB = '';
let batchId = '';
let animalId = '';
let unitA = '';
let unitB = '';

const hA = (t = token) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });
const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;

suite('Mortality + movement read endpoints (slice 11.5a)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['MMRead Farm A', 'MMRead Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.owner);
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'MMRead Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'MMRead Farm B' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(hA())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const cattle = sp.find((s: { code: string }) => s.code === 'CATTLE').id;
    unitA = (await request(app).post('/api/farm/units').set(hA()).send({ name: 'MM Shed A', type: 'POULTRY' })).body.unit.id;
    unitB = (await request(app).post('/api/farm/units').set(hA()).send({ name: 'MM Shed B', type: 'POULTRY' })).body.unit.id;
    batchId = (await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chicken, code: 'MM-B1', initialCount: 100, unitId: unitA })).body.batch.id;
    animalId = (await request(app).post('/api/farm/animals').set(hA()).send({ speciesId: cattle, tagNumber: 'MM-C1', unitId: unitA })).body.animal.id;

    await request(app).post('/api/farm/mortality').set(hA()).send({ batchId, type: 'MORTALITY', count: 10, cause: 'heat', occurredAt: '2026-06-01T08:00:00.000Z' });
    await request(app).post('/api/farm/mortality').set(hA()).send({ batchId, type: 'CULL', count: 5, occurredAt: '2026-06-03T08:00:00.000Z' });
    await request(app).post('/api/farm/mortality').set(hA()).send({ animalId, type: 'CULL', cause: 'age', occurredAt: '2026-06-05T08:00:00.000Z' });

    await request(app).post('/api/farm/movements').set(hA()).send({ batchId, toUnitId: unitB, reason: 'rotation' });

    // farm B bait
    const spB = (await request(app).get('/api/farm/species').set(hB())).body.species;
    const chickenB = spB.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const unitBB = (await request(app).post('/api/farm/units').set(hB()).send({ name: 'MM Shed BB', type: 'POULTRY' })).body.unit.id;
    const batchB = (await request(app).post('/api/farm/batches').set(hB()).send({ speciesId: chickenB, code: 'MM-BB1', initialCount: 10 })).body.batch.id;
    await request(app).post('/api/farm/mortality').set(hB()).send({ batchId: batchB, type: 'MORTALITY', count: 1 });
    await request(app).post('/api/farm/movements').set(hB()).send({ batchId: batchB, toUnitId: unitBB });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('GET /mortality lists events desc with batch/animal joins, farm-scoped', async () => {
    const res = await request(app).get('/api/farm/mortality').set(hA());
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(3); // farm B's event not visible
    const [latest] = res.body.events;
    expect(latest.animal).toEqual({ id: animalId, tagNumber: 'MM-C1' });
    expect(latest.batch).toBeNull();
    const batchEvent = res.body.events[2];
    expect(batchEvent.batch).toEqual({ id: batchId, code: 'MM-B1' });
    expect(batchEvent.count).toBe(10);
  });

  it('GET /mortality filters by batchId, animalId, type, from/to', async () => {
    const byBatch = await request(app).get(`/api/farm/mortality?batchId=${batchId}`).set(hA());
    expect(byBatch.body.events).toHaveLength(2);
    const byAnimal = await request(app).get(`/api/farm/mortality?animalId=${animalId}`).set(hA());
    expect(byAnimal.body.events).toHaveLength(1);
    const culls = await request(app).get('/api/farm/mortality?type=CULL').set(hA());
    expect(culls.body.events).toHaveLength(2);
    const window = await request(app)
      .get('/api/farm/mortality?from=2026-06-02T00:00:00.000Z&to=2026-06-04T00:00:00.000Z')
      .set(hA());
    expect(window.body.events).toHaveLength(1);
    expect((await request(app).get('/api/farm/mortality?type=NOPE').set(hA())).status).toBe(400);
  });

  it('GET /mortality paged envelope; LABOUR can read but not write', async () => {
    const paged = await request(app).get('/api/farm/mortality?page=1&pageSize=2').set(hA());
    expect(paged.body.total).toBe(3);
    expect(paged.body.items).toHaveLength(2);

    const labourRead = await request(app).get('/api/farm/mortality').set(hA(labourToken));
    expect(labourRead.status).toBe(200);
    const labourWrite = await request(app).post('/api/farm/mortality').set(hA(labourToken)).send({ batchId, type: 'MORTALITY', count: 1 });
    expect(labourWrite.status).toBe(403);
  });

  it('GET /movements lists with joins + unit ids as-is; filters; paged; LABOUR read-only', async () => {
    const res = await request(app).get('/api/farm/movements').set(hA());
    expect(res.status).toBe(200);
    expect(res.body.movements).toHaveLength(1); // farm B's movement not visible
    const [m] = res.body.movements;
    expect(m.batch).toEqual({ id: batchId, code: 'MM-B1' });
    expect(m.fromUnitId).toBe(unitA);
    expect(m.toUnitId).toBe(unitB);
    expect(m.count).toBe(85); // 100 - 10 - 5 at move time

    const byBatch = await request(app).get(`/api/farm/movements?batchId=${batchId}`).set(hA());
    expect(byBatch.body.movements).toHaveLength(1);
    const none = await request(app).get('/api/farm/movements?from=2099-01-01').set(hA());
    expect(none.body.movements).toHaveLength(0);

    const paged = await request(app).get('/api/farm/movements?page=1&pageSize=10').set(hA());
    expect(paged.body.total).toBe(1);

    expect((await request(app).get('/api/farm/movements').set(hA(labourToken))).status).toBe(200);
    const labourWrite = await request(app).post('/api/farm/movements').set(hA(labourToken)).send({ batchId, toUnitId: unitA });
    expect(labourWrite.status).toBe(403);
  });

  it('farm B sees only its own events (IDOR)', async () => {
    const res = await request(app).get('/api/farm/mortality').set(hB());
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].batch.code).toBe('MM-BB1');
    const mv = await request(app).get('/api/farm/movements').set(hB());
    expect(mv.body.movements).toHaveLength(1);
  });
});
