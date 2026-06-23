import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'AssetTest123!';
const emails = { owner: 'assettest-owner@ifm.local', labour: 'assettest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

suite('Assets + maintenance (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Asset Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Asset Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('creates an asset; LABOUR create → 403', async () => {
    const res = await request(app)
      .post('/api/farm/assets')
      .set(h(ownerToken))
      .send({ name: 'Diesel Generator', type: 'MACHINERY', purchaseCostPaise: 15000000 });
    expect(res.status).toBe(201);
    expect(res.body.asset.purchaseCostPaise).toBe('15000000');

    const lab = await request(app).post('/api/farm/assets').set(h(labourToken)).send({ name: 'x' });
    expect(lab.status).toBe(403);
  });

  it('schedules service due soon → shows in reminders; recording service advances next due', async () => {
    const asset = (await request(app).post('/api/farm/assets').set(h(ownerToken)).send({ name: 'Feed Mixer', type: 'EQUIPMENT' })).body.asset;
    const sched = (
      await request(app)
        .post(`/api/farm/assets/${asset.id}/schedules`)
        .set(h(ownerToken))
        .send({ name: 'Oil change', intervalDays: 90, nextDueDate: daysFromNow(3) })
    ).body.schedule;
    expect(sched.intervalDays).toBe(90);

    const rem = await request(app).get('/api/farm/assets/reminders').set(h(ownerToken));
    expect(rem.body.due.some((d: { id: string }) => d.id === sched.id)).toBe(true);

    // Record the service against the schedule → nextDueDate jumps ~90 days out, leaving reminders.
    const rec = await request(app)
      .post(`/api/farm/assets/${asset.id}/maintenance`)
      .set(h(ownerToken))
      .send({ scheduleId: sched.id, type: 'SERVICE', costPaise: 250000, vendor: 'Local mechanic' });
    expect(rec.status).toBe(201);
    expect(rec.body.record.costPaise).toBe('250000');

    const rem2 = await request(app).get('/api/farm/assets/reminders').set(h(ownerToken));
    expect(rem2.body.due.some((d: { id: string }) => d.id === sched.id)).toBe(false); // pushed out
  });

  it('lists maintenance records for an asset', async () => {
    const asset = (await request(app).post('/api/farm/assets').set(h(ownerToken)).send({ name: 'Tractor', type: 'VEHICLE' })).body.asset;
    await request(app).post(`/api/farm/assets/${asset.id}/maintenance`).set(h(ownerToken)).send({ type: 'REPAIR', costPaise: 500000 });
    const list = await request(app).get(`/api/farm/assets/${asset.id}/maintenance`).set(h(ownerToken));
    expect(list.body.records).toHaveLength(1);
    expect(list.body.records[0].type).toBe('REPAIR');
  });
});
