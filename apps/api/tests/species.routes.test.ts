import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'SpecTest123!';
const emails = { creator: 'spectest-creator@ifm.local', labour: 'spectest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm1 = '';
let farm2 = '';

async function login(email: string) {
  const r = await request(app).post('/api/auth/login').send({ email, password: pw });
  return r.body.accessToken as string;
}

suite('Species reference (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Spec Farm 1', 'Spec Farm 2'] } } });

    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);

    // createFarm auto-seeds the reference catalogue.
    farm1 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Spec Farm 1' })).body.farm.id;
    farm2 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Spec Farm 2' })).body.farm.id;

    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm1, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farm1, farm2] } } });
    await prisma.$disconnect();
  });

  it('seeds 10 system-default species on farm creation', async () => {
    const res = await request(app).get('/api/farm/species').set('Authorization', `Bearer ${token}`).set('X-Farm-Id', farm1);
    expect(res.status).toBe(200);
    expect(res.body.species).toHaveLength(10);
    const cattle = res.body.species.find((s: { code: string }) => s.code === 'CATTLE');
    expect(cattle.trackingMode).toBe('INDIVIDUAL');
    const chicken = res.body.species.find((s: { code: string }) => s.code === 'CHICKEN');
    expect(chicken.trackingMode).toBe('BATCH');
  });

  it('detail returns ordered stages + breeds', async () => {
    const list = await request(app).get('/api/farm/species').set('Authorization', `Bearer ${token}`).set('X-Farm-Id', farm1);
    const chickenId = list.body.species.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const res = await request(app).get(`/api/farm/species/${chickenId}`).set('Authorization', `Bearer ${token}`).set('X-Farm-Id', farm1);
    expect(res.status).toBe(200);
    expect(res.body.species.stages.map((s: { name: string }) => s.name)).toEqual(['Chick', 'Grower', 'Finisher']);
    expect(res.body.species.stages.at(-1).isTerminal).toBe(true);
    expect(res.body.species.breeds.length).toBeGreaterThan(0);
  });

  it('cross-farm species id → 404 (no leak)', async () => {
    const list = await request(app).get('/api/farm/species').set('Authorization', `Bearer ${token}`).set('X-Farm-Id', farm1);
    const someId = list.body.species[0].id;
    const res = await request(app).get(`/api/farm/species/${someId}`).set('Authorization', `Bearer ${token}`).set('X-Farm-Id', farm2);
    expect(res.status).toBe(404);
  });

  it('LABOUR cannot create a species (403)', async () => {
    const res = await request(app)
      .post('/api/farm/species')
      .set('Authorization', `Bearer ${labourToken}`)
      .set('X-Farm-Id', farm1)
      .send({ code: 'EMU', name: 'Emu', trackingMode: 'BATCH' });
    expect(res.status).toBe(403);
  });

  it('duplicate species code → 409', async () => {
    const res = await request(app)
      .post('/api/farm/species')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Farm-Id', farm1)
      .send({ code: 'CHICKEN', name: 'Chicken Again', trackingMode: 'BATCH' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SPECIES_CODE_TAKEN');
  });
});
