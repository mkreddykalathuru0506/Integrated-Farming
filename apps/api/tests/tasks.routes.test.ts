import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'TaskTest123!';
const emails = { creator: 'tasktest-creator@ifm.local', labour: 'tasktest-labour@ifm.local' };
let token = '';
let labourToken = '';
let farm = '';
const todayStr = new Date().toISOString().slice(0, 10);

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });
const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

suite('Task engine (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Task Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    token = await login(emails.creator);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Task Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    await request(app).post('/api/farm/schedules').set(h(token)).send({ name: 'Daily Feeding', taskType: 'FEEDING', frequency: 'DAILY' });
    await request(app).post('/api/farm/schedules').set(h(token)).send({ name: 'Weekly Cleaning', taskType: 'CLEANING', frequency: 'WEEKLY' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
    await prisma.$disconnect();
  });

  it('generates daily tasks idempotently', async () => {
    await request(app).post(`/api/farm/tasks/generate?date=${todayStr}`).set(h(token));
    const first = await request(app).get(`/api/farm/tasks?date=${todayStr}`).set(h(token));
    const count1 = first.body.tasks.filter((x: { title: string }) => x.title === 'Daily Feeding').length;
    expect(count1).toBe(1);
    await request(app).post(`/api/farm/tasks/generate?date=${todayStr}`).set(h(token));
    const second = await request(app).get(`/api/farm/tasks?date=${todayStr}`).set(h(token));
    const count2 = second.body.tasks.filter((x: { title: string }) => x.title === 'Daily Feeding').length;
    expect(count2).toBe(1); // no duplicate
  });

  it('a member (labour) can complete a task', async () => {
    const list = await request(app).get(`/api/farm/tasks?date=${todayStr}`).set(h(token));
    const task = list.body.tasks.find((x: { title: string }) => x.title === 'Daily Feeding');
    const res = await request(app).post(`/api/farm/tasks/${task.id}/complete`).set(h(labourToken)).send({});
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('DONE');
    expect(res.body.task.completedAt).toBeTruthy();
  });

  it('WEEKLY generates on Monday but not Tuesday', async () => {
    await request(app).post('/api/farm/tasks/generate?date=2024-01-02').set(h(token)); // Tuesday
    const tue = await request(app).get('/api/farm/tasks?date=2024-01-02').set(h(token));
    expect(titles(tue.body.tasks)).not.toContain('Weekly Cleaning');

    await request(app).post('/api/farm/tasks/generate?date=2024-01-08').set(h(token)); // Monday
    const mon = await request(app).get('/api/farm/tasks?date=2024-01-08').set(h(token));
    expect(titles(mon.body.tasks)).toContain('Weekly Cleaning');
  });

  it('sweeps past PENDING tasks to MISSED', async () => {
    const mon = await request(app).get('/api/farm/tasks?date=2024-01-08').set(h(token));
    const weekly = mon.body.tasks.find((x: { title: string }) => x.title === 'Weekly Cleaning');
    expect(weekly.status).toBe('MISSED'); // generate also swept past PENDING
  });

  it('LABOUR cannot create a schedule template (403)', async () => {
    const res = await request(app).post('/api/farm/schedules').set(h(labourToken)).send({ name: 'X', taskType: 'OTHER', frequency: 'DAILY' });
    expect(res.status).toBe(403);
  });
});
