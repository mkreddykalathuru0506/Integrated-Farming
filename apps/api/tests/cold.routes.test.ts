import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'ColdTest123!';
const emails = { owner: 'coldtest-owner@ifm.local', labour: 'coldtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Cold storage + temperature log (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Cold Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Cold Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('creates a FROZEN store with the default −18°C band; LABOUR create → 403', async () => {
    const res = await request(app).post('/api/farm/coldstorage').set(h(ownerToken)).send({ name: 'Freezer A', mode: 'FROZEN' });
    expect(res.status).toBe(201);
    expect(res.body.store.maxTempC).toBe(-18);

    const lab = await request(app).post('/api/farm/coldstorage').set(h(labourToken)).send({ name: 'X', mode: 'FROZEN' });
    expect(lab.status).toBe(403);
  });

  it('records in-band + out-of-range readings; LABOUR may log; alert surfaces breach', async () => {
    const store = (await request(app).post('/api/farm/coldstorage').set(h(ownerToken)).send({ name: 'Freezer B', mode: 'FROZEN' })).body.store;

    const ok = await request(app).post(`/api/farm/coldstorage/${store.id}/temps`).set(h(labourToken)).send({ temperatureC: -20 });
    expect(ok.status).toBe(201);
    expect(ok.body.temp.isOutOfRange).toBe(false);

    const breach = await request(app).post(`/api/farm/coldstorage/${store.id}/temps`).set(h(ownerToken)).send({ temperatureC: -5 });
    expect(breach.body.temp.isOutOfRange).toBe(true); // warmer than −18

    const list = await request(app).get('/api/farm/coldstorage').set(h(ownerToken));
    const b = list.body.stores.find((s: { id: string }) => s.id === store.id);
    expect(b.latest.temperatureC).toBe(-5);
    expect(b.breachCount).toBe(1);

    const alerts = await request(app).get('/api/farm/coldstorage/alerts').set(h(ownerToken));
    expect(alerts.body.alerts.some((a: { coldStorage: { id: string } }) => a.coldStorage.id === store.id)).toBe(true);
  });

  it('FRESH store flags above 7°C', async () => {
    const store = (await request(app).post('/api/farm/coldstorage').set(h(ownerToken)).send({ name: 'Chiller', mode: 'FRESH' })).body.store;
    expect(store.maxTempC).toBe(7);
    const hot = await request(app).post(`/api/farm/coldstorage/${store.id}/temps`).set(h(ownerToken)).send({ temperatureC: 12 });
    expect(hot.body.temp.isOutOfRange).toBe(true);
  });
});
