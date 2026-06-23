import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'AnimalTest123!';
const emails = { creator: 'animaltest-creator@ifm.local', labour: 'animaltest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm1 = '';
let farm2 = '';
let cattleId = '';
let chickenId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const hdr = (t: string, farm: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Individual animals (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Animal Farm 1', 'Animal Farm 2'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);
    farm1 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Animal Farm 1' })).body.farm.id;
    farm2 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Animal Farm 2' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm1, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(hdr(token, farm1))).body.species;
    cattleId = sp.find((s: { code: string }) => s.code === 'CATTLE').id;
    chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farm1, farm2] } } });
  });

  let animalId = '';
  it('creates a cow with QR + first stage', async () => {
    const res = await request(app)
      .post('/api/farm/animals')
      .set(hdr(token, farm1))
      .send({ speciesId: cattleId, tagNumber: 'COW-001', sex: 'FEMALE' });
    expect(res.status).toBe(201);
    expect(res.body.animal.qrCode).toMatch(/^IFM-A-/);
    expect(res.body.animal.currentStage.name).toBe('Calf');
    expect(res.body.animal.status).toBe('ACTIVE');
    animalId = res.body.animal.id;
  });

  it('rejects an animal for a BATCH species (422)', async () => {
    const res = await request(app)
      .post('/api/farm/animals')
      .set(hdr(token, farm1))
      .send({ speciesId: chickenId, tagNumber: 'CHK-1' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SPECIES_NOT_INDIVIDUAL');
  });

  it('duplicate tag → 409; LABOUR create → 403', async () => {
    const dup = await request(app).post('/api/farm/animals').set(hdr(token, farm1)).send({ speciesId: cattleId, tagNumber: 'COW-001' });
    expect(dup.status).toBe(409);
    const lab = await request(app).post('/api/farm/animals').set(hdr(labourToken, farm1)).send({ speciesId: cattleId, tagNumber: 'COW-002' });
    expect(lab.status).toBe(403);
  });

  it('lists animals; cross-farm id → 404', async () => {
    const list = await request(app).get('/api/farm/animals').set(hdr(token, farm1));
    expect(list.body.animals.map((a: { tagNumber: string }) => a.tagNumber)).toContain('COW-001');
    const cross = await request(app).get(`/api/farm/animals/${animalId}`).set(hdr(token, farm2));
    expect(cross.status).toBe(404);
  });
});
