import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'WxTest123!';
const emails = { owner: 'wxtest-owner@ifm.local', labour: 'wxtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Weather + heat-stress risk (integration, mock provider)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Weather Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Weather Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('requires farm location before weather (422)', async () => {
    const res = await request(app).get('/api/farm/weather').set(h(ownerToken));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LOCATION_REQUIRED');
  });

  it('fetches weather (mock = 38°C) with source/as-of and raises a heat-stress flag', async () => {
    await request(app).put('/api/farm/settings').set(h(ownerToken)).send({ latitude: 17.385, longitude: 78.4867 });
    const res = await request(app).get('/api/farm/weather').set(h(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.weather.source).toBe('mock');
    expect(res.body.weather.tempC).toBe(38);
    expect(res.body.weather.fetchedAt).toBeTruthy(); // "as of"
    expect(res.body.risk.atRisk).toBe(true);
    expect(res.body.risk.reason).toContain('Heat stress');

    const risks = await request(app).get('/api/farm/risk?status=OPEN').set(h(ownerToken));
    const heat = risks.body.risks.find((r: { type: string }) => r.type === 'HEAT_STRESS');
    expect(heat).toBeTruthy();
    expect(heat.reason).toContain('Heat stress');
  });

  it('caches within the day (second call is cached)', async () => {
    const res = await request(app).get('/api/farm/weather').set(h(ownerToken));
    expect(res.body.cached).toBe(true);
  });

  it('acknowledges a risk flag; LABOUR ack → 403', async () => {
    const risks = await request(app).get('/api/farm/risk').set(h(ownerToken));
    const id = risks.body.risks[0].id;

    const lab = await request(app).post(`/api/farm/risk/${id}/ack`).set(h(labourToken));
    expect(lab.status).toBe(403);

    const ok = await request(app).post(`/api/farm/risk/${id}/ack`).set(h(ownerToken));
    expect(ok.status).toBe(200);
    expect(ok.body.risk.status).toBe('ACKNOWLEDGED');
  });
});
