import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'ExpLc123!';
const emails = { owner: 'explc-owner@ifm.local', labour: 'explc-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farmA = '';
let farmB = '';
let batchA = '';
let expKeep = ''; // survives the suite
let expDel = ''; // soft-deleted mid-suite

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, farm = farmA) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

async function waitForAudit(where: Prisma.AuditLogWhereInput, tries = 40, delayMs = 50) {
  for (let i = 0; i < tries; i++) {
    const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

suite('Expense lifecycle — PATCH + soft-DELETE + read sweep (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['ExpLc Farm A', 'ExpLc Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'ExpLc Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'ExpLc Farm B' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchA = (
      await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'EXPLC-1', initialCount: 100 })
    ).body.batch.id;

    expKeep = (
      await request(app).post('/api/farm/expenses').set(h(ownerToken)).send({ category: 'MEDICINE', amountPaise: 100000, batchId: batchA })
    ).body.expense.id;
    expDel = (
      await request(app).post('/api/farm/expenses').set(h(ownerToken)).send({ category: 'OTHER', amountPaise: 50000, batchId: batchA })
    ).body.expense.id;
  });

  afterAll(async () => {
    const owner = await prisma.user.findUnique({ where: { email: emails.owner } });
    if (owner) await prisma.auditLog.deleteMany({ where: { userId: owner.id } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('PATCH edits amount/category/description (money stays integer-paise string)', async () => {
    const res = await request(app)
      .patch(`/api/farm/expenses/${expKeep}`)
      .set(h(ownerToken))
      .send({ amountPaise: 120000, category: 'UTILITIES', description: 'power bill' });
    expect(res.status).toBe(200);
    expect(res.body.expense.amountPaise).toBe('120000');
    expect(res.body.expense.category).toBe('UTILITIES');
    expect(res.body.expense.description).toBe('power bill');
  });

  it('PATCH validates: empty body → 400, foreign batch → 422 INVALID_TARGET', async () => {
    const empty = await request(app).patch(`/api/farm/expenses/${expKeep}`).set(h(ownerToken)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION');

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken, farmB))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const foreignBatch = (
      await request(app).post('/api/farm/batches').set(h(ownerToken, farmB)).send({ speciesId: chickenId, code: 'EXPLC-B', initialCount: 5 })
    ).body.batch.id;
    const res = await request(app).patch(`/api/farm/expenses/${expKeep}`).set(h(ownerToken)).send({ batchId: foreignBatch });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TARGET');
  });

  it('PATCH is farm-scoped (other farm → 404) and role-gated (LABOUR → 403)', async () => {
    const idor = await request(app).patch(`/api/farm/expenses/${expKeep}`).set(h(ownerToken, farmB)).send({ amountPaise: 1 });
    expect(idor.status).toBe(404);
    const rbac = await request(app).patch(`/api/farm/expenses/${expKeep}`).set(h(labourToken)).send({ amountPaise: 1 });
    expect(rbac.status).toBe(403);
    const rbacDel = await request(app).delete(`/api/farm/expenses/${expKeep}`).set(h(labourToken));
    expect(rbacDel.status).toBe(403);
  });

  it('soft-DELETE removes the expense from list, batch cost, farm P&L and finance summary', async () => {
    // Before: keep=120000 (patched above) + del=50000.
    const costBefore = await request(app).get(`/api/farm/expenses/batch-cost?batchId=${batchA}`).set(h(ownerToken));
    expect(costBefore.body.totalPaise).toBe('170000');

    const del = await request(app).delete(`/api/farm/expenses/${expDel}`).set(h(ownerToken));
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true, id: expDel });

    const list = await request(app).get('/api/farm/expenses').set(h(ownerToken));
    expect(list.body.expenses.map((e: { id: string }) => e.id)).not.toContain(expDel);
    expect(list.body.expenses.map((e: { id: string }) => e.id)).toContain(expKeep);

    const cost = await request(app).get(`/api/farm/expenses/batch-cost?batchId=${batchA}`).set(h(ownerToken));
    expect(cost.body.totalPaise).toBe('120000');
    expect(cost.body.byCategory.OTHER).toBeUndefined();

    const pnl = await request(app).get('/api/farm/invoices/pnl/farm').set(h(ownerToken));
    expect(pnl.body.costPaise).toBe('120000'); // deleted 50000 no longer counted

    const summary = await request(app).get('/api/farm/finance/summary').set(h(ownerToken));
    const totalExpense = summary.body.buckets.reduce((s: number, b: { expensePaise: string }) => s + Number(b.expensePaise), 0);
    expect(totalExpense).toBe(120000);
  });

  it('a deleted expense is gone: PATCH → 404, second DELETE → 404', async () => {
    const patch = await request(app).patch(`/api/farm/expenses/${expDel}`).set(h(ownerToken)).send({ amountPaise: 1 });
    expect(patch.status).toBe(404);
    const del = await request(app).delete(`/api/farm/expenses/${expDel}`).set(h(ownerToken));
    expect(del.status).toBe(404);
  });

  it('audit rows exist for the lifecycle writes (expenses.update, expenses.delete)', async () => {
    const upd = await waitForAudit({ farmId: farmA, action: 'expenses.update', entityId: expKeep });
    expect(upd).not.toBeNull();
    const del = await waitForAudit({ farmId: farmA, action: 'expenses.delete', entityId: expDel });
    expect(del).not.toBeNull();
    expect(del!.entity).toBe('Expenses');
  });
});
