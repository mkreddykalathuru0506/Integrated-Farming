import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'AuditTest123!';
const email = 'audittest-owner@ifm.local';
let token = '';
let farmId = '';
let chickenId = '';

const login = async (e: string) =>
  (await request(app).post('/api/auth/login').send({ email: e, password: pw })).body.accessToken as string;
const hdr = (t: string, farm: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

/** Audit rows are written in a post-response `finish` handler (fire-and-forget), so poll for them. */
async function waitForAudit(where: Prisma.AuditLogWhereInput, tries = 40, delayMs = 50) {
  for (let i = 0; i < tries; i++) {
    const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

suite('Audit log on every write (integration)', () => {
  beforeAll(async () => {
    const prior = await prisma.user.findUnique({ where: { email } });
    if (prior) await prisma.auditLog.deleteMany({ where: { userId: prior.id } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: 'Audit Farm' } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = await login(email);
    farmId = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Audit Farm' })
    ).body.farm.id;
    const sp = (await request(app).get('/api/farm/species').set(hdr(token, farmId))).body.species;
    chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: farmId } });
  });

  it('records farm creation (POST /api/farms → farm.create)', async () => {
    const row = await waitForAudit({ action: 'farm.create', entityId: farmId });
    expect(row).not.toBeNull();
    expect(row!.entity).toBe('Farm');
    expect(row!.entityId).toBe(farmId);
  });

  it('records a successful farm-scoped write with who/what/where', async () => {
    const res = await request(app)
      .post('/api/farm/batches')
      .set(hdr(token, farmId))
      .send({ speciesId: chickenId, code: 'AUD-1', initialCount: 50 });
    expect(res.status).toBe(201);
    const batchId = res.body.batch.id;

    const row = await waitForAudit({ farmId, action: 'batches.create' });
    expect(row).not.toBeNull();
    expect(row!.entity).toBe('Batches');
    expect(row!.entityId).toBe(batchId);
    expect(row!.userId).toBeTruthy();
    expect(typeof row!.ip).toBe('string'); // client IP captured
  });

  it('captures the named sub-action in the audit action (batches.advance)', async () => {
    const create = await request(app)
      .post('/api/farm/batches')
      .set(hdr(token, farmId))
      .send({ speciesId: chickenId, code: 'AUD-2', initialCount: 20 });
    const batchId = create.body.batch.id;
    await request(app).post(`/api/farm/batches/${batchId}/advance`).set(hdr(token, farmId));

    const row = await waitForAudit({ farmId, action: 'batches.advance', entityId: batchId });
    expect(row).not.toBeNull();
    expect(row!.entity).toBe('Batches');
  });

  it('does NOT audit reads (GET) or failed writes (422)', async () => {
    const before = await prisma.auditLog.count({ where: { farmId } });

    // A read — must not be audited.
    await request(app).get('/api/farm/batches').set(hdr(token, farmId));
    // A rejected write (cattle is INDIVIDUAL → 422) — must not be audited.
    const sp = (await request(app).get('/api/farm/species').set(hdr(token, farmId))).body.species;
    const cattleId = sp.find((s: { code: string }) => s.code === 'CATTLE').id;
    const bad = await request(app)
      .post('/api/farm/batches')
      .set(hdr(token, farmId))
      .send({ speciesId: cattleId, code: 'AUD-BAD', initialCount: 3 });
    expect(bad.status).toBe(422);

    // Give any (erroneous) async audit a chance to land, then assert nothing new was written.
    await new Promise((r) => setTimeout(r, 300));
    const after = await prisma.auditLog.count({ where: { farmId } });
    expect(after).toBe(before);
  });
});
