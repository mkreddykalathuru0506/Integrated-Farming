import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { runDueReports } from '../src/reports/schedule.service';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'RepLc123!';
const emails = { owner: 'replc-owner@ifm.local', labour: 'replc-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farmId = '';
let scheduleId = '';

const past = new Date(Date.now() - 3_600_000).toISOString();

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farmId });

const farmLogs = () => prisma.notificationLog.count({ where: { farmId } });

suite('Report schedule lifecycle — pause / edit / soft-delete (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'RepLc Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farmId = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'RepLc Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    scheduleId = (
      await request(app)
        .post('/api/farm/reports/schedules')
        .set(h(ownerToken))
        .send({ name: 'RepLc weekly', frequency: 'WEEKLY', recipient: 'owner@replc.local', nextRunAt: past })
    ).body.schedule.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farmId } });
  });

  it('paused schedule (isActive: false) is skipped by the runDueReports sweep', async () => {
    const res = await request(app).patch(`/api/farm/reports/schedules/${scheduleId}`).set(h(ownerToken)).send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.schedule.isActive).toBe(false);

    const before = await farmLogs();
    await runDueReports();
    expect(await farmLogs()).toBe(before); // nothing delivered for this farm

    const row = await prisma.reportSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(row.lastRunAt).toBeNull();
  });

  it('PATCH edits recipient/nextRunAt; resumed schedule fires again', async () => {
    const res = await request(app)
      .patch(`/api/farm/reports/schedules/${scheduleId}`)
      .set(h(ownerToken))
      .send({ isActive: true, recipient: 'new@replc.local', nextRunAt: past });
    expect(res.status).toBe(200);
    expect(res.body.schedule.recipient).toBe('new@replc.local');
    expect(res.body.schedule.isActive).toBe(true);

    const before = await farmLogs();
    await runDueReports();
    expect(await farmLogs()).toBe(before + 1); // delivered (mock channel → NotificationLog)

    const row = await prisma.reportSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
    expect(row.lastRunAt).not.toBeNull();
    expect(row.nextRunAt.getTime()).toBeGreaterThan(Date.now()); // advanced by a week
  });

  it('soft-DELETE hides the schedule from the list and from the sweep; PATCH after → 404', async () => {
    // Make it due again so only the deletedAt filter can exclude it from the sweep.
    await request(app).patch(`/api/farm/reports/schedules/${scheduleId}`).set(h(ownerToken)).send({ nextRunAt: past });

    const del = await request(app).delete(`/api/farm/reports/schedules/${scheduleId}`).set(h(ownerToken));
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true, id: scheduleId });

    const list = await request(app).get('/api/farm/reports/schedules').set(h(ownerToken));
    expect(list.body.schedules.map((s: { id: string }) => s.id)).not.toContain(scheduleId);

    const before = await farmLogs();
    await runDueReports();
    expect(await farmLogs()).toBe(before);

    const patch = await request(app).patch(`/api/farm/reports/schedules/${scheduleId}`).set(h(ownerToken)).send({ isActive: true });
    expect(patch.status).toBe(404);
    const delAgain = await request(app).delete(`/api/farm/reports/schedules/${scheduleId}`).set(h(ownerToken));
    expect(delAgain.status).toBe(404);
  });

  it('lifecycle writes are role-gated (LABOUR → 403)', async () => {
    const patch = await request(app).patch(`/api/farm/reports/schedules/${scheduleId}`).set(h(labourToken)).send({ isActive: false });
    expect(patch.status).toBe(403);
    const del = await request(app).delete(`/api/farm/reports/schedules/${scheduleId}`).set(h(labourToken));
    expect(del.status).toBe(403);
  });
});
