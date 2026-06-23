import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'LogTest123!';
const emails = { creator: 'logtest-creator@ifm.local', labour: 'logtest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm = '';
let farm2 = '';
let batchId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, f: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': f });

suite('Daily logging (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Log Farm', 'Log Farm 2'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Log Farm' })).body.farm.id;
    farm2 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Log Farm 2' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(token, farm))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (await request(app).post('/api/farm/batches').set(h(token, farm)).send({ speciesId: chickenId, code: 'LOG-BR-1', initialCount: 50 })).body.batch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farm, farm2] } } });
    await prisma.$disconnect();
  });

  it('LABOUR can log feed for a batch', async () => {
    const res = await request(app)
      .post('/api/farm/logs')
      .set(h(labourToken, farm))
      .send({ type: 'FEED', batchId, quantity: 25, unit: 'kg' });
    expect(res.status).toBe(201);
    expect(res.body.log.type).toBe('FEED');
  });

  it('is idempotent on clientLogId (offline-sync replay)', async () => {
    const clientLogId = 'client-log-0001-abcdef';
    const a = await request(app).post('/api/farm/logs').set(h(token, farm)).send({ type: 'EGGS', batchId, quantity: 40, unit: 'units', clientLogId });
    expect(a.status).toBe(201);
    const b = await request(app).post('/api/farm/logs').set(h(token, farm)).send({ type: 'EGGS', batchId, quantity: 40, unit: 'units', clientLogId });
    expect(b.status).toBe(201);
    expect(b.body.log.id).toBe(a.body.log.id); // same row, not a duplicate

    const list = await request(app).get('/api/farm/logs?type=EGGS').set(h(token, farm));
    const matches = list.body.logs.filter((l: { clientLogId: string }) => l.clientLogId === clientLogId);
    expect(matches).toHaveLength(1);
  });

  it('cross-farm batch target → 422', async () => {
    const res = await request(app).post('/api/farm/logs').set(h(token, farm2)).send({ type: 'FEED', batchId, quantity: 5, unit: 'kg' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TARGET');
  });
});
