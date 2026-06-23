import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'MktTest123!';
const emails = { owner: 'mkttest-owner@ifm.local', labour: 'mkttest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Market rates + price-drop risk (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Market Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Market Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('records a manual rate; LABOUR create → 403', async () => {
    const res = await request(app)
      .post('/api/farm/market')
      .set(h(ownerToken))
      .send({ commodity: 'Broiler', pricePaise: 10000, unit: 'kg', market: 'Hyderabad' });
    expect(res.status).toBe(201);
    expect(res.body.rate.pricePaise).toBe('10000');
    expect(res.body.rate.source).toBe('manual');

    const lab = await request(app).post('/api/farm/market').set(h(labourToken)).send({ commodity: 'X', pricePaise: 1, unit: 'kg' });
    expect(lab.status).toBe(403);
  });

  it('raises a PRICE_DROP flag when the price falls ≥10%', async () => {
    // prior reading was 10000; now 8000 = 20% drop
    const res = await request(app).post('/api/farm/market').set(h(ownerToken)).send({ commodity: 'Broiler', pricePaise: 8000, unit: 'kg' });
    expect(res.body.risk.atRisk).toBe(true);
    expect(res.body.risk.reason).toContain('%');

    const risks = await request(app).get('/api/farm/risk?status=OPEN').set(h(ownerToken));
    const drop = risks.body.risks.find((r: { type: string }) => r.type === 'PRICE_DROP');
    expect(drop).toBeTruthy();
    expect(drop.reason).toContain('Broiler');
  });

  it('no flag when price is stable', async () => {
    await request(app).post('/api/farm/market').set(h(ownerToken)).send({ commodity: 'Maize', pricePaise: 200000, unit: 'quintal' });
    const res = await request(app).post('/api/farm/market').set(h(ownerToken)).send({ commodity: 'Maize', pricePaise: 199000, unit: 'quintal' });
    expect(res.body.risk.atRisk).toBe(false);
  });

  it('refresh pulls from the provider (mock) and lists latest per commodity', async () => {
    const ref = await request(app).post('/api/farm/market/refresh').set(h(ownerToken)).send({ commodity: 'Egg' });
    expect(ref.status).toBe(201);
    expect(ref.body.rate.source).toBe('mock');

    const list = await request(app).get('/api/farm/market').set(h(ownerToken));
    const broiler = list.body.rates.filter((r: { commodity: string }) => r.commodity === 'Broiler');
    expect(broiler).toHaveLength(1); // latest only
    expect(broiler[0].pricePaise).toBe('8000');
  });
});
