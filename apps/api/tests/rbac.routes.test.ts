import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const farmA = 'rbac-test-farm-a';
const farmB = 'rbac-test-farm-b';
const pw = 'RbacTest123!';
const users = {
  ownerA: 'rbac-ownera@ifm.local',
  labourA: 'rbac-laboura@ifm.local',
  ownerB: 'rbac-ownerb@ifm.local',
};

async function login(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: pw });
  return res.body.accessToken as string;
}

suite('RBAC + farm scoping (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(users) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });

    await prisma.farm.create({ data: { id: farmA, name: 'RBAC Farm A' } });
    await prisma.farm.create({ data: { id: farmB, name: 'RBAC Farm B' } });

    for (const email of Object.values(users)) {
      await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    }

    const ownerA = await prisma.user.findUniqueOrThrow({ where: { email: users.ownerA } });
    const labourA = await prisma.user.findUniqueOrThrow({ where: { email: users.labourA } });
    const ownerB = await prisma.user.findUniqueOrThrow({ where: { email: users.ownerB } });
    await prisma.membership.create({ data: { userId: ownerA.id, farmId: farmA, role: 'OWNER' } });
    await prisma.membership.create({ data: { userId: labourA.id, farmId: farmA, role: 'LABOUR' } });
    await prisma.membership.create({ data: { userId: ownerB.id, farmId: farmB, role: 'OWNER' } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(users) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('OWNER of farm A can list members', async () => {
    const token = await login(users.ownerA);
    const res = await request(app)
      .get('/api/farm/members')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Farm-Id', farmA);
    expect(res.status).toBe(200);
    const emails = res.body.members.map((m: { email: string }) => m.email);
    expect(emails).toContain(users.ownerA);
    expect(emails).toContain(users.labourA);
  });

  it('LABOUR is blocked by role gate (403)', async () => {
    const token = await login(users.labourA);
    const res = await request(app)
      .get('/api/farm/members')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Farm-Id', farmA);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('OWNER of farm B cannot reach farm A (no cross-farm leak)', async () => {
    const token = await login(users.ownerB);
    const res = await request(app)
      .get('/api/farm/members')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Farm-Id', farmA);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('missing X-Farm-Id → 400 FARM_REQUIRED', async () => {
    const token = await login(users.ownerA);
    const res = await request(app).get('/api/farm/members').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FARM_REQUIRED');
  });

  it('/api/me/farms returns only the caller’s farms', async () => {
    const token = await login(users.ownerA);
    const res = await request(app).get('/api/me/farms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.farms).toHaveLength(1);
    expect(res.body.farms[0].farmId).toBe(farmA);
    expect(res.body.farms[0].role).toBe('OWNER');
  });
});
