import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'ActivityTest123!';
const names = {
  ownerA: 'Activity Owner A',
  ownerB: 'Activity Owner B',
  manager: 'Activity Manager',
  labour: 'Activity Labour',
};
const emails = {
  ownerA: 'activitytest-owner-a@ifm.local',
  ownerB: 'activitytest-owner-b@ifm.local',
  manager: 'activitytest-manager@ifm.local',
  labour: 'activitytest-labour@ifm.local',
};
let ownerAToken = '';
let ownerBToken = '';
let managerToken = '';
let labourToken = '';
let farmA = '';
let farmB = '';
let managerUserId = '';
let farmBCustomerId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, farm: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });
const feed = (t: string, farm: string, query: Record<string, string | number> = {}) =>
  request(app).get('/api/farm/audit').query(query).set(h(t, farm));

/** Audit rows land in a post-response `finish` handler (fire-and-forget) — poll for them. */
async function waitForAuditCount(farmId: string, atLeast: number, tries = 60, delayMs = 50): Promise<number> {
  let count = 0;
  for (let i = 0; i < tries; i++) {
    count = await prisma.auditLog.count({ where: { farmId } });
    if (count >= atLeast) return count;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return count;
}

type Item = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
};

suite('Activity feed /api/farm/audit (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['Activity Farm A', 'Activity Farm B'] } } });
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      await request(app).post('/api/auth/register').send({ email: emails[key], name: names[key], password: pw });
    }
    ownerAToken = await login(emails.ownerA);
    ownerBToken = await login(emails.ownerB);
    farmA = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerAToken}`).send({ name: 'Activity Farm A' })
    ).body.farm.id;
    farmB = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerBToken}`).send({ name: 'Activity Farm B' })
    ).body.farm.id;

    const manager = await prisma.user.findUniqueOrThrow({ where: { email: emails.manager } });
    managerUserId = manager.id;
    await prisma.membership.create({ data: { userId: manager.id, farmId: farmA, role: 'MANAGER' } });
    managerToken = await login(emails.manager);
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    // Real mutations through the API → audit rows via the auditWrite middleware.
    for (let i = 1; i <= 3; i++) {
      await request(app).post('/api/farm/customers').set(h(ownerAToken, farmA)).send({ name: `Activity Cust ${i}` });
    }
    await request(app).post('/api/farm/vendors').set(h(ownerAToken, farmA)).send({ name: 'Activity Vendor 1' });
    await request(app).post('/api/farm/workers').set(h(managerToken, farmA)).send({ name: 'Activity Worker 1' });
    // Farm B gets exactly one farm-scoped write.
    farmBCustomerId = (
      await request(app).post('/api/farm/customers').set(h(ownerBToken, farmB)).send({ name: 'Activity Cust B' })
    ).body.customer.id;

    await waitForAuditCount(farmA, 5);
    await waitForAuditCount(farmB, 1);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { farmId: { in: [farmA, farmB] } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('surfaces a fresh API write in the feed, newest first, with the user resolved', async () => {
    const created = await request(app)
      .post('/api/farm/customers')
      .set(h(ownerAToken, farmA))
      .send({ name: 'Activity Cust Fresh' });
    expect(created.status).toBe(201);
    const customerId = created.body.customer.id as string;
    await waitForAuditCount(farmA, 6);

    const res = await feed(ownerAToken, farmA);
    expect(res.status).toBe(200);
    const items = res.body.items as Item[];
    expect(items.length).toBeGreaterThanOrEqual(6);
    // Newest first → the write we just made is on top.
    expect(items[0]).toMatchObject({
      action: 'customers.create',
      entity: 'Customers',
      entityId: customerId,
    });
    expect(items[0]!.user).toMatchObject({ name: names.ownerA });
    expect(typeof items[0]!.createdAt).toBe('string');
    // Monotonic ordering across the page.
    for (let i = 1; i < items.length; i++) {
      expect(new Date(items[i - 1]!.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(items[i]!.createdAt).getTime());
    }
  });

  it('walks the whole feed via cursor pagination without overlap or skips', async () => {
    const total = await prisma.auditLog.count({ where: { farmId: farmA } });
    expect(total).toBeGreaterThanOrEqual(6);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: Record<string, string | number> = { limit: 2 };
      if (cursor) query.cursor = cursor;
      const res = await feed(ownerAToken, farmA, query);
      expect(res.status).toBe(200);
      expect((res.body.items as Item[]).length).toBeLessThanOrEqual(2);
      seen.push(...(res.body.items as Item[]).map((i) => i.id));
      cursor = res.body.nextCursor as string | null;
      pages++;
    } while (cursor && pages < 50);

    expect(new Set(seen).size).toBe(seen.length); // no duplicates
    expect(seen.length).toBe(total); // no skips — every row reached
  });

  it('filters by entity, action, userId and from/to', async () => {
    const byEntity = await feed(ownerAToken, farmA, { entity: 'Vendors' });
    expect(byEntity.status).toBe(200);
    expect((byEntity.body.items as Item[]).length).toBeGreaterThanOrEqual(1);
    for (const item of byEntity.body.items as Item[]) expect(item.entity).toBe('Vendors');

    const byAction = await feed(ownerAToken, farmA, { action: 'workers.create' });
    expect((byAction.body.items as Item[]).length).toBeGreaterThanOrEqual(1);
    for (const item of byAction.body.items as Item[]) expect(item.action).toBe('workers.create');

    const byUser = await feed(ownerAToken, farmA, { userId: managerUserId });
    expect((byUser.body.items as Item[]).length).toBeGreaterThanOrEqual(1);
    for (const item of byUser.body.items as Item[]) expect(item.user).toMatchObject({ id: managerUserId, name: names.manager });

    const all = await feed(ownerAToken, farmA, { from: '2000-01-01' });
    expect((all.body.items as Item[]).length).toBeGreaterThanOrEqual(6);
    const none = await feed(ownerAToken, farmA, { to: '2000-01-01' });
    expect(none.body.items).toEqual([]);
    expect(none.body.nextCursor).toBeNull();

    // Mid-range: everything at/after the 2nd-newest row's timestamp.
    const latest = (all.body.items as Item[])[1]!;
    const fromMid = await feed(ownerAToken, farmA, { from: latest.createdAt });
    expect((fromMid.body.items as Item[]).length).toBeGreaterThanOrEqual(2);
    for (const item of fromMid.body.items as Item[]) {
      expect(new Date(item.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(latest.createdAt).getTime());
    }
  });

  it('resolves a system row (null userId) to user: null', async () => {
    await prisma.auditLog.create({
      data: { farmId: farmA, userId: null, action: 'system.test', entity: 'System' },
    });
    const res = await feed(ownerAToken, farmA, { action: 'system.test' });
    expect(res.status).toBe(200);
    expect((res.body.items as Item[])[0]!.user).toBeNull();
  });

  it('never leaks across farms (IDOR)', async () => {
    const farmARows = await prisma.auditLog.findMany({ where: { farmId: farmA }, select: { id: true } });
    const farmAIds = new Set(farmARows.map((r) => r.id));

    const resB = await feed(ownerBToken, farmB);
    expect(resB.status).toBe(200);
    const itemsB = resB.body.items as Item[];
    expect(itemsB.length).toBeGreaterThanOrEqual(1);
    expect(itemsB.some((i) => i.entityId === farmBCustomerId)).toBe(true);
    for (const item of itemsB) expect(farmAIds.has(item.id)).toBe(false);

    // Owner A cannot read farm B's feed at all.
    const cross = await feed(ownerAToken, farmB);
    expect(cross.status).toBe(403);
  });

  it("rejects another farm's audit row id used as a cursor (400 BAD_CURSOR)", async () => {
    const rowB = await prisma.auditLog.findFirstOrThrow({ where: { farmId: farmB } });
    const res = await feed(ownerAToken, farmA, { cursor: rowB.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_CURSOR');
  });

  it('rejects an unknown cursor and an out-of-range limit', async () => {
    const unknown = await feed(ownerAToken, farmA, { cursor: 'cnope00000000000000000000' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('BAD_CURSOR');

    const bigLimit = await feed(ownerAToken, farmA, { limit: 200 });
    expect(bigLimit.status).toBe(400);
    expect(bigLimit.body.error.code).toBe('VALIDATION');
  });

  it('is OWNER/MANAGER-only: MANAGER 200, LABOUR 403, anonymous 401', async () => {
    const manager = await feed(managerToken, farmA);
    expect(manager.status).toBe(200);

    const labour = await feed(labourToken, farmA);
    expect(labour.status).toBe(403);

    const anon = await request(app).get('/api/farm/audit');
    expect(anon.status).toBe(401);
  });
});
