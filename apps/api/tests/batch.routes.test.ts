import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'BatchTest123!';
const emails = { creator: 'batchtest-creator@ifm.local', labour: 'batchtest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm1 = '';
let farm2 = '';
let chickenId = '';
let cattleId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const hdr = (t: string, farm: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Batch records + stage machine (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Batch Farm 1', 'Batch Farm 2'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);
    farm1 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Batch Farm 1' })).body.farm.id;
    farm2 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Batch Farm 2' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm1, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(hdr(token, farm1))).body.species;
    chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    cattleId = sp.find((s: { code: string }) => s.code === 'CATTLE').id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farm1, farm2] } } });
    await prisma.$disconnect();
  });

  let batchId = '';
  it('creates a chicken batch at the first stage', async () => {
    const res = await request(app)
      .post('/api/farm/batches')
      .set(hdr(token, farm1))
      .send({ speciesId: chickenId, code: 'BR-1', initialCount: 100 });
    expect(res.status).toBe(201);
    expect(res.body.batch.currentStage.name).toBe('Chick');
    expect(res.body.batch.currentCount).toBe(100);
    expect(res.body.batch.qrCode).toMatch(/^IFM-B-/);
    batchId = res.body.batch.id;
  });

  it('rejects a batch for an INDIVIDUAL species (422)', async () => {
    const res = await request(app)
      .post('/api/farm/batches')
      .set(hdr(token, farm1))
      .send({ speciesId: cattleId, code: 'COW-BATCH', initialCount: 5 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SPECIES_NOT_BATCH');
  });

  it('advances Chick → Grower → Finisher, then 422 at the end', async () => {
    const a1 = await request(app).post(`/api/farm/batches/${batchId}/advance`).set(hdr(token, farm1));
    expect(a1.body.batch.currentStage.name).toBe('Grower');
    const a2 = await request(app).post(`/api/farm/batches/${batchId}/advance`).set(hdr(token, farm1));
    expect(a2.body.batch.currentStage.name).toBe('Finisher');
    const a3 = await request(app).post(`/api/farm/batches/${batchId}/advance`).set(hdr(token, farm1));
    expect(a3.status).toBe(422);
    expect(a3.body.error.code).toBe('NO_NEXT_STAGE');
  });

  it('duplicate code → 409; LABOUR create → 403', async () => {
    const dup = await request(app).post('/api/farm/batches').set(hdr(token, farm1)).send({ speciesId: chickenId, code: 'BR-1', initialCount: 10 });
    expect(dup.status).toBe(409);
    const lab = await request(app).post('/api/farm/batches').set(hdr(labourToken, farm1)).send({ speciesId: chickenId, code: 'BR-2', initialCount: 10 });
    expect(lab.status).toBe(403);
  });

  it('cross-farm batch id → 404', async () => {
    const res = await request(app).get(`/api/farm/batches/${batchId}`).set(hdr(token, farm2));
    expect(res.status).toBe(404);
  });

  it('closes the batch', async () => {
    const res = await request(app).post(`/api/farm/batches/${batchId}/close`).set(hdr(token, farm1));
    expect(res.status).toBe(200);
    expect(res.body.batch.status).toBe('CLOSED');
  });
});
