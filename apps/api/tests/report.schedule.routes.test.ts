import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { runDueReports } from '../src/reports/schedule.service';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'RschTest123!';
const emails = { owner: 'rschtest-owner@ifm.local', labour: 'rschtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Scheduled report delivery (integration, mock)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Report Schedule Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Report Schedule Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('creates a weekly schedule; LABOUR create → 403', async () => {
    const res = await request(app)
      .post('/api/farm/reports/schedules')
      .set(h(ownerToken))
      .send({ name: 'Weekly summary', frequency: 'WEEKLY', format: 'pdf', recipient: 'owner@demo.farm' });
    expect(res.status).toBe(201);
    expect(res.body.schedule.frequency).toBe('WEEKLY');

    const lab = await request(app)
      .post('/api/farm/reports/schedules')
      .set(h(labourToken))
      .send({ name: 'x', frequency: 'DAILY', recipient: 'x@y.z' });
    expect(lab.status).toBe(403);
  });

  it('run-now generates + delivers (mock) and advances next run', async () => {
    const sched = (
      await request(app)
        .post('/api/farm/reports/schedules')
        .set(h(ownerToken))
        .send({ name: 'On-demand', frequency: 'WEEKLY', format: 'xlsx', recipient: 'a@b.c' })
    ).body.schedule;

    const run = await request(app).post(`/api/farm/reports/schedules/${sched.id}/run`).set(h(ownerToken));
    expect(run.status).toBe(200);
    expect(run.body.delivered).toBe(true);
    expect(run.body.bytes).toBeGreaterThan(0);

    // a delivery NotificationLog (MOCKED, no spend) was recorded
    const alerts = await request(app).get('/api/farm/alerts').set(h(ownerToken));
    const delivery = alerts.body.alerts.find((a: { subject: string }) => a.subject === 'On-demand');
    expect(delivery).toBeTruthy();
    expect(delivery.status).toBe('MOCKED');

    // next run advanced into the future
    const list = await request(app).get('/api/farm/reports/schedules').set(h(ownerToken));
    const after = list.body.schedules.find((s: { id: string }) => s.id === sched.id);
    expect(new Date(after.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    expect(after.lastRunAt).toBeTruthy();
  });

  it('runDueReports sweep runs schedules whose nextRunAt has passed', async () => {
    // a schedule due in the past
    await request(app)
      .post('/api/farm/reports/schedules')
      .set(h(ownerToken))
      .send({ name: 'Backdated', frequency: 'DAILY', recipient: 'd@e.f', nextRunAt: '2020-01-01T00:00:00.000Z' });
    const { ran } = await runDueReports(new Date());
    expect(ran).toBeGreaterThanOrEqual(1);
  });
});
