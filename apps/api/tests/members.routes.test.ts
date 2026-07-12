import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'MembersTest123!';
const users = {
  ownerA: 's114b-ownera@ifm.local',
  ownerB: 's114b-ownerb@ifm.local',
  manager: 's114b-manager@ifm.local',
  acct: 's114b-acct@ifm.local',
  worker: 's114b-worker@ifm.local',
  owner2: 's114b-owner2@ifm.local',
  mixedCase: 'S114b-Case@ifm.local', // registered with this exact casing
  ownerC: 's114b-ownerc@ifm.local',
  ownerC2: 's114b-ownerc2@ifm.local',
};
const farmNames = ['S114B Farm A', 'S114B Farm B', 'S114B Farm C'];

let farmA = '';
let farmB = '';
let farmC = '';
let ownerAToken = '';
let acctUserId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body
    .accessToken as string;
const hdr = (t: string, farm: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });
const userId = async (email: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

/** Audit rows are written in a post-response `finish` handler (fire-and-forget) — poll. */
async function waitForAudit(where: Prisma.AuditLogWhereInput, tries = 40, delayMs = 50) {
  for (let i = 0; i < tries; i++) {
    const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function cleanup() {
  const prior = await prisma.user.findMany({
    where: { email: { in: Object.values(users) } },
    select: { id: true },
  });
  const priorFarms = await prisma.farm.findMany({
    where: { name: { in: farmNames } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: prior.map((u) => u.id) } },
        { farmId: { in: priorFarms.map((f) => f.id) } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { email: { in: Object.values(users) } } });
  await prisma.farm.deleteMany({ where: { name: { in: farmNames } } });
}

suite('Membership lifecycle /api/farm/members (integration)', () => {
  beforeAll(async () => {
    await cleanup();
    for (const email of Object.values(users)) {
      await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    }
    ownerAToken = await login(users.ownerA);
    farmA = (
      await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ name: 'S114B Farm A' })
    ).body.farm.id;
    const ownerBToken = await login(users.ownerB);
    farmB = (
      await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${ownerBToken}`)
        .send({ name: 'S114B Farm B' })
    ).body.farm.id;
    // Scaffolding memberships (not under test): a MANAGER on farm A for the RBAC checks.
    await prisma.membership.create({
      data: { userId: await userId(users.manager), farmId: farmA, role: 'MANAGER' },
    });
    acctUserId = await userId(users.acct);
  });

  afterAll(async () => {
    await cleanup();
  });

  // ---- POST /api/farm/members ----

  it('OWNER adds an existing user by email → 201 ACTIVE member, listed by GET', async () => {
    const res = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.acct, role: 'ACCOUNTANT' });
    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({
      userId: acctUserId,
      name: users.acct,
      email: users.acct,
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
    });
    expect(typeof res.body.member.id).toBe('string'); // membership id (audit entityId)

    const list = await request(app).get('/api/farm/members').set(hdr(ownerAToken, farmA));
    expect(list.status).toBe(200);
    const emails = list.body.members.map((m: { email: string }) => m.email);
    expect(emails).toContain(users.acct);
  });

  it('unknown email → 404 USER_NOT_FOUND with a register-first message', async () => {
    const res = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: 's114b-nobody@ifm.local', role: 'LABOUR' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
    expect(res.body.error.message).toMatch(/register/i);
  });

  it('already-ACTIVE member → 409 ALREADY_MEMBER', async () => {
    const res = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.acct, role: 'MANAGER' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('email lookup is case-insensitive', async () => {
    const res = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.mixedCase.toLowerCase(), role: 'BUYER' });
    expect(res.status).toBe(201);
    expect(res.body.member.email).toBe(users.mixedCase); // stored casing returned
    expect(res.body.member.role).toBe('BUYER');
  });

  it('validation: bad role / bad email → 400 VALIDATION', async () => {
    const badRole = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.acct, role: 'SUPERADMIN' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.code).toBe('VALIDATION');

    const badEmail = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: 'not-an-email', role: 'LABOUR' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('VALIDATION');
  });

  // ---- RBAC ----

  it('MANAGER is 403 on add, role change and deactivate (OWNER-only writes)', async () => {
    const t = await login(users.manager);
    const post = await request(app)
      .post('/api/farm/members')
      .set(hdr(t, farmA))
      .send({ email: users.worker, role: 'LABOUR' });
    const patch = await request(app)
      .patch(`/api/farm/members/${acctUserId}`)
      .set(hdr(t, farmA))
      .send({ role: 'LABOUR' });
    const del = await request(app).delete(`/api/farm/members/${acctUserId}`).set(hdr(t, farmA));
    for (const res of [post, patch, del]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('unauthenticated → 401 on all three writes', async () => {
    const post = await request(app)
      .post('/api/farm/members')
      .set('X-Farm-Id', farmA)
      .send({ email: users.worker, role: 'LABOUR' });
    const patch = await request(app)
      .patch(`/api/farm/members/${acctUserId}`)
      .set('X-Farm-Id', farmA)
      .send({ role: 'LABOUR' });
    const del = await request(app).delete(`/api/farm/members/${acctUserId}`).set('X-Farm-Id', farmA);
    for (const res of [post, patch, del]) expect(res.status).toBe(401);
  });

  // ---- PATCH /api/farm/members/:userId ----

  it('PATCH changes a member role → 200', async () => {
    const res = await request(app)
      .patch(`/api/farm/members/${acctUserId}`)
      .set(hdr(ownerAToken, farmA))
      .send({ role: 'MANAGER' });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ userId: acctUserId, role: 'MANAGER', status: 'ACTIVE' });
  });

  it('PATCH of an absent member → 404 NOT_FOUND', async () => {
    const res = await request(app)
      .patch('/api/farm/members/cknope0000000000000000000')
      .set(hdr(ownerAToken, farmA))
      .send({ role: 'LABOUR' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ---- Last-owner guard ----

  it('demoting the sole ACTIVE OWNER → 422 LAST_OWNER', async () => {
    const ownerAId = await userId(users.ownerA);
    const res = await request(app)
      .patch(`/api/farm/members/${ownerAId}`)
      .set(hdr(ownerAToken, farmA))
      .send({ role: 'MANAGER' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });

  it('removing the sole ACTIVE OWNER → 422 LAST_OWNER', async () => {
    const ownerAId = await userId(users.ownerA);
    const res = await request(app)
      .delete(`/api/farm/members/${ownerAId}`)
      .set(hdr(ownerAToken, farmA));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });

  it('demote and remove an OWNER succeed once a second ACTIVE OWNER exists', async () => {
    const add = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.owner2, role: 'OWNER' });
    expect(add.status).toBe(201);
    const owner2Id = add.body.member.userId as string;

    // Demote the second owner (first owner remains) → allowed.
    const demote = await request(app)
      .patch(`/api/farm/members/${owner2Id}`)
      .set(hdr(ownerAToken, farmA))
      .send({ role: 'MANAGER' });
    expect(demote.status).toBe(200);
    expect(demote.body.member.role).toBe('MANAGER');

    // Promote back, then remove an OWNER while another remains → allowed.
    await request(app)
      .patch(`/api/farm/members/${owner2Id}`)
      .set(hdr(ownerAToken, farmA))
      .send({ role: 'OWNER' });
    const del = await request(app)
      .delete(`/api/farm/members/${owner2Id}`)
      .set(hdr(ownerAToken, farmA));
    expect(del.status).toBe(200);
    expect(del.body.member.status).toBe('SUSPENDED');
  });

  // ---- DELETE (deactivate) + reactivation ----

  it('DELETE suspends; the suspended user loses /api/farm/* access; re-DELETE → 404', async () => {
    const add = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.worker, role: 'LABOUR' });
    expect(add.status).toBe(201);
    const workerId = add.body.member.userId as string;

    const workerToken = await login(users.worker);
    const before = await request(app).get('/api/farm/species').set(hdr(workerToken, farmA));
    expect(before.status).toBe(200); // access while ACTIVE

    const del = await request(app)
      .delete(`/api/farm/members/${workerId}`)
      .set(hdr(ownerAToken, farmA));
    expect(del.status).toBe(200);
    expect(del.body.member.status).toBe('SUSPENDED');

    // Next request with the same still-valid token dies at the membership check.
    const after = await request(app).get('/api/farm/species').set(hdr(workerToken, farmA));
    expect(after.status).toBe(403);
    expect(after.body.error.code).toBe('FORBIDDEN');

    // Deactivation is not idempotent: an already-SUSPENDED member is "not found".
    const again = await request(app)
      .delete(`/api/farm/members/${workerId}`)
      .set(hdr(ownerAToken, farmA));
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('NOT_FOUND');
  });

  it('re-adding a SUSPENDED member reactivates the same membership with the new role → 200', async () => {
    const suspended = await prisma.membership.findUniqueOrThrow({
      where: { userId_farmId: { userId: await userId(users.worker), farmId: farmA } },
    });
    expect(suspended.status).toBe('SUSPENDED');

    const res = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmA))
      .send({ email: users.worker, role: 'VETERINARIAN' });
    expect(res.status).toBe(200); // reactivated, not created
    expect(res.body.member.id).toBe(suspended.id); // same membership row
    expect(res.body.member).toMatchObject({ role: 'VETERINARIAN', status: 'ACTIVE' });

    // Access is restored on the next request.
    const workerToken = await login(users.worker);
    const read = await request(app).get('/api/farm/species').set(hdr(workerToken, farmA));
    expect(read.status).toBe(200);
  });

  // ---- Farm scoping / IDOR ----

  it('OWNER of farm A cannot manage farm B (403), and lists never leak across farms', async () => {
    const post = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerAToken, farmB))
      .send({ email: users.worker, role: 'LABOUR' });
    const patch = await request(app)
      .patch(`/api/farm/members/${acctUserId}`)
      .set(hdr(ownerAToken, farmB))
      .send({ role: 'LABOUR' });
    const del = await request(app)
      .delete(`/api/farm/members/${acctUserId}`)
      .set(hdr(ownerAToken, farmB));
    for (const res of [post, patch, del]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }

    const list = await request(app).get('/api/farm/members').set(hdr(ownerAToken, farmA));
    const emails = list.body.members.map((m: { email: string }) => m.email);
    expect(emails).not.toContain(users.ownerB);
  });

  // ---- Audit ----

  it('audit rows land for members.create / members.update / members.delete', async () => {
    const ownerAId = await userId(users.ownerA);

    const created = await waitForAudit({ farmId: farmA, action: 'members.create' });
    expect(created).not.toBeNull();
    expect(created!.entity).toBe('Members');
    expect(created!.userId).toBe(ownerAId);
    expect(created!.entityId).toBeTruthy(); // membership id picked from the response body

    const updated = await waitForAudit({
      farmId: farmA,
      action: 'members.update',
      entityId: acctUserId, // target user id from the URL
    });
    expect(updated).not.toBeNull();
    expect(updated!.entity).toBe('Members');

    const deleted = await waitForAudit({ farmId: farmA, action: 'members.delete' });
    expect(deleted).not.toBeNull();
    expect(deleted!.entity).toBe('Members');
  });

  // ---- Concurrency (race-safe last-owner guard) ----

  it('two concurrent demotions of the only two OWNERs → exactly one succeeds', async () => {
    const ownerCToken = await login(users.ownerC);
    farmC = (
      await request(app)
        .post('/api/farms')
        .set('Authorization', `Bearer ${ownerCToken}`)
        .send({ name: 'S114B Farm C' })
    ).body.farm.id;
    const add = await request(app)
      .post('/api/farm/members')
      .set(hdr(ownerCToken, farmC))
      .send({ email: users.ownerC2, role: 'OWNER' });
    expect(add.status).toBe(201);

    const ownerCId = await userId(users.ownerC);
    const ownerC2Id = add.body.member.userId as string;
    const ownerC2Token = await login(users.ownerC2);

    // Each owner demotes the other at the same time. Naively both pass the "another
    // owner exists" read; the serializable transaction must let only one commit.
    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/farm/members/${ownerC2Id}`)
        .set(hdr(ownerCToken, farmC))
        .send({ role: 'MANAGER' }),
      request(app)
        .patch(`/api/farm/members/${ownerCId}`)
        .set(hdr(ownerC2Token, farmC))
        .send({ role: 'MANAGER' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const blocked = a.status === 422 ? a : b;
    expect(blocked.body.error.code).toBe('LAST_OWNER');

    // Invariant holds: exactly one ACTIVE OWNER remains.
    const owners = await prisma.membership.count({
      where: { farmId: farmC, role: 'OWNER', status: 'ACTIVE' },
    });
    expect(owners).toBe(1);
  });
});
