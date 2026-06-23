import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'AlertTest123!';
const emails = { owner: 'alerttest-owner@ifm.local', labour: 'alerttest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Alert routing (mock NotificationService) + dashboard (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Alert Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Alert Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    // Generate two risk flags: heat-stress (weather mock = 38°C) + price-drop (manual).
    await request(app).put('/api/farm/settings').set(h(ownerToken)).send({ latitude: 17.385, longitude: 78.4867 });
    await request(app).get('/api/farm/weather').set(h(ownerToken));
    await request(app).post('/api/farm/market').set(h(ownerToken)).send({ commodity: 'Broiler', pricePaise: 10000, unit: 'kg' });
    await request(app).post('/api/farm/market').set(h(ownerToken)).send({ commodity: 'Broiler', pricePaise: 7000, unit: 'kg' }); // 30% drop
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('dispatches alerts for open flags (mock, no spend) and is idempotent; LABOUR → 403', async () => {
    const lab = await request(app).post('/api/farm/alerts/dispatch').set(h(labourToken)).send({});
    expect(lab.status).toBe(403);

    const res = await request(app).post('/api/farm/alerts/dispatch').set(h(ownerToken)).send({ channel: 'SMS' });
    expect(res.status).toBe(200);
    expect(res.body.dispatched).toBe(2); // heat-stress + price-drop

    // re-dispatch skips already-notified flags
    const again = await request(app).post('/api/farm/alerts/dispatch').set(h(ownerToken)).send({});
    expect(again.body.dispatched).toBe(0);

    const list = await request(app).get('/api/farm/alerts').set(h(ownerToken));
    expect(list.body.alerts).toHaveLength(2);
    expect(list.body.alerts[0].status).toBe('MOCKED'); // no real send
    expect(list.body.alerts.every((a: { riskFlagId: string | null }) => a.riskFlagId)).toBe(true);
  });

  it('dashboard summarises open risks, weather, market', async () => {
    const d = await request(app).get('/api/farm/dashboard').set(h(ownerToken));
    expect(d.status).toBe(200);
    expect(d.body.risks.open).toBeGreaterThanOrEqual(2);
    expect(d.body.weather.tempC).toBe(38);
    expect(d.body.market.some((m: { commodity: string }) => m.commodity === 'Broiler')).toBe(true);
    expect(d.body.alerts.total).toBeGreaterThanOrEqual(2);
  });
});
