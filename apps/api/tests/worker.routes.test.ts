import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'WorkerTest123!';
const emails = { creator: 'workertest-creator@ifm.local', labour: 'workertest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm = '';
let farm2 = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, f: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': f });

suite('Workers + attendance (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Worker Farm', 'Worker Farm 2'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Worker Farm' })).body.farm.id;
    farm2 = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Worker Farm 2' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farm, farm2] } } });
  });

  let workerId = '';
  it('creates a worker with wage in paise (string round-trip)', async () => {
    const res = await request(app)
      .post('/api/farm/workers')
      .set(h(token, farm))
      .send({ name: 'Ramesh', wageType: 'DAILY', dailyWageRatePaise: '50000' });
    expect(res.status).toBe(201);
    expect(res.body.worker.dailyWageRatePaise).toBe('50000');
    workerId = res.body.worker.id;
  });

  it('lists workers; cross-farm id → 404', async () => {
    const list = await request(app).get('/api/farm/workers').set(h(token, farm));
    expect(list.body.workers.map((w: { name: string }) => w.name)).toContain('Ramesh');
    const cross = await request(app).get(`/api/farm/workers/${workerId}`).set(h(token, farm2));
    expect(cross.status).toBe(404);
  });

  it('marks attendance idempotently (re-mark updates, no dupe)', async () => {
    const d = '2026-06-23';
    const a1 = await request(app).post('/api/farm/attendance').set(h(token, farm)).send({ workerId, date: d, status: 'PRESENT' });
    expect(a1.status).toBe(201);
    const a2 = await request(app).post('/api/farm/attendance').set(h(token, farm)).send({ workerId, date: d, status: 'ABSENT' });
    expect(a2.status).toBe(201);
    const list = await request(app).get(`/api/farm/attendance?date=${d}`).set(h(token, farm));
    expect(list.body.attendance).toHaveLength(1);
    expect(list.body.attendance[0].status).toBe('ABSENT');
  });

  it('LABOUR cannot create a worker (403)', async () => {
    const res = await request(app).post('/api/farm/workers').set(h(labourToken, farm)).send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});
