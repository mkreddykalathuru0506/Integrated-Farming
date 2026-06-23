import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'EventTest123!';
const emails = { creator: 'eventtest-creator@ifm.local', labour: 'eventtest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm = '';
let unitA = '';
let unitB = '';
let chickenId = '';
let cattleId = '';
let batchId = '';
let animalId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Mortality + movement (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Event Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Event Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(token))).body.species;
    chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    cattleId = sp.find((s: { code: string }) => s.code === 'CATTLE').id;

    unitA = (await request(app).post('/api/farm/units').set(h(token)).send({ name: 'Shed A', type: 'POULTRY' })).body.unit.id;
    unitB = (await request(app).post('/api/farm/units').set(h(token)).send({ name: 'Shed B', type: 'POULTRY' })).body.unit.id;
    batchId = (await request(app).post('/api/farm/batches').set(h(token)).send({ speciesId: chickenId, code: 'EV-1', initialCount: 100, unitId: unitA })).body.batch.id;
    animalId = (await request(app).post('/api/farm/animals').set(h(token)).send({ speciesId: cattleId, tagNumber: 'EV-COW-1', unitId: unitA })).body.animal.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
    await prisma.$disconnect();
  });

  it('batch mortality decrements currentCount', async () => {
    const res = await request(app).post('/api/farm/mortality').set(h(token)).send({ batchId, type: 'MORTALITY', count: 10, cause: 'heat' });
    expect(res.status).toBe(201);
    expect(res.body.currentCount).toBe(90);
    const got = await request(app).get(`/api/farm/batches/${batchId}`).set(h(token));
    expect(got.body.batch.currentCount).toBe(90);
  });

  it('batch loss over currentCount → 422 (count unchanged)', async () => {
    const res = await request(app).post('/api/farm/mortality').set(h(token)).send({ batchId, type: 'CULL', count: 1000 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_COUNT');
    const got = await request(app).get(`/api/farm/batches/${batchId}`).set(h(token));
    expect(got.body.batch.currentCount).toBe(90);
  });

  it('moves a batch to another unit (logs movement)', async () => {
    const res = await request(app).post('/api/farm/movements').set(h(token)).send({ batchId, toUnitId: unitB });
    expect(res.status).toBe(201);
    expect(res.body.movement.toUnitId).toBe(unitB);
    const got = await request(app).get(`/api/farm/batches/${batchId}`).set(h(token));
    expect(got.body.batch.unit.id).toBe(unitB);
  });

  it('moves an animal, then cull → CULLED, repeat cull → 422', async () => {
    const mv = await request(app).post('/api/farm/movements').set(h(token)).send({ animalId, toUnitId: unitB });
    expect(mv.status).toBe(201);

    const cull = await request(app).post('/api/farm/mortality').set(h(token)).send({ animalId, type: 'CULL', cause: 'injury' });
    expect(cull.status).toBe(201);
    expect(cull.body.animalStatus).toBe('CULLED');

    const again = await request(app).post('/api/farm/mortality').set(h(token)).send({ animalId, type: 'CULL' });
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('ALREADY_INACTIVE');
  });

  it('LABOUR cannot record mortality (403)', async () => {
    const res = await request(app).post('/api/farm/mortality').set(h(labourToken)).send({ batchId, type: 'MORTALITY', count: 1 });
    expect(res.status).toBe(403);
  });
});
