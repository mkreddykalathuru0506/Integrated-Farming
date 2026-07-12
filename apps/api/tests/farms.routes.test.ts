import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'FarmTest123!';
const emails = {
  creator: 'farmtest-creator@ifm.local',
  labour: 'farmtest-labour@ifm.local',
  creator2: 'farmtest-creator2@ifm.local',
};

let token1 = '';
let token2 = '';
let tokenLabour = '';
let farm1 = '';
let farm2 = '';

async function register(email: string) {
  await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
}
async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: pw });
  return res.body.accessToken as string;
}

suite('Farm & Unit CRUD (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Farm One', 'Farm Two'] } } });

    for (const e of Object.values(emails)) await register(e);
    token1 = await login(emails.creator);
    token2 = await login(emails.creator2);

    const f1 = await request(app)
      .post('/api/farms')
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Farm One', state: 'Telangana' });
    farm1 = f1.body.farm.id;

    const f2 = await request(app)
      .post('/api/farms')
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Farm Two' });
    farm2 = f2.body.farm.id;

    // Add a LABOUR member to farm1 to test role-gated writes.
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm1, role: 'LABOUR' } });
    tokenLabour = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farm1, farm2] } } });
  });

  it('creator becomes OWNER of the new farm', async () => {
    const res = await request(app).get('/api/me/farms').set('Authorization', `Bearer ${token1}`);
    const f = res.body.farms.find((x: { farmId: string }) => x.farmId === farm1);
    expect(f.role).toBe('OWNER');
  });

  it('GET /api/farm returns createdAt (ISO) for the dashboard all-time period', async () => {
    const res = await request(app)
      .get('/api/farm')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1);
    expect(res.status).toBe(200);
    expect(res.body.farm.id).toBe(farm1);
    expect(typeof res.body.farm.createdAt).toBe('string');
    expect(Number.isNaN(new Date(res.body.farm.createdAt).getTime())).toBe(false);
  });

  it('default settings row was created', async () => {
    const res = await request(app)
      .get('/api/farm/settings')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1);
    expect(res.status).toBe(200);
    expect(res.body.settings.timezone).toBe('Asia/Kolkata');
    expect(res.body.settings.gstThresholdPaise).toBeNull();
  });

  let unitId = '';
  it('OWNER creates a unit; duplicate name → 409', async () => {
    const res = await request(app)
      .post('/api/farm/units')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1)
      .send({ name: 'Shed A', type: 'POULTRY' });
    expect(res.status).toBe(201);
    unitId = res.body.unit.id;

    const dup = await request(app)
      .post('/api/farm/units')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1)
      .send({ name: 'Shed A', type: 'POULTRY' });
    expect(dup.status).toBe(409);
  });

  it('lists the unit', async () => {
    const res = await request(app)
      .get('/api/farm/units')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1);
    expect(res.body.units.map((u: { name: string }) => u.name)).toContain('Shed A');
  });

  it('LABOUR cannot create a unit (403)', async () => {
    const res = await request(app)
      .post('/api/farm/units')
      .set('Authorization', `Bearer ${tokenLabour}`)
      .set('X-Farm-Id', farm1)
      .send({ name: 'Shed B', type: 'CATTLE' });
    expect(res.status).toBe(403);
  });

  it('cross-farm unit access is blocked (404, no leak)', async () => {
    const res = await request(app)
      .patch(`/api/farm/units/${unitId}`)
      .set('Authorization', `Bearer ${token2}`)
      .set('X-Farm-Id', farm2)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it('settings: gstThresholdPaise round-trips as a string; invalid rejected', async () => {
    const ok = await request(app)
      .put('/api/farm/settings')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1)
      .send({ gstThresholdPaise: '400000000', fssaiTier: 'STATE', gstin: '29ABCDE1234F1Z5' });
    expect(ok.status).toBe(200);
    expect(ok.body.settings.gstThresholdPaise).toBe('400000000');
    expect(ok.body.settings.fssaiTier).toBe('STATE');

    const bad = await request(app)
      .put('/api/farm/settings')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1)
      .send({ gstThresholdPaise: -5 });
    expect(bad.status).toBe(400);
  });

  it('soft-deletes a unit (gone from list, row persists)', async () => {
    const del = await request(app)
      .delete(`/api/farm/units/${unitId}`)
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get('/api/farm/units')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Farm-Id', farm1);
    expect(list.body.units.find((u: { id: string }) => u.id === unitId)).toBeUndefined();

    const row = await prisma.unit.findUnique({ where: { id: unitId } });
    expect(row?.deletedAt).not.toBeNull();
  });
});
