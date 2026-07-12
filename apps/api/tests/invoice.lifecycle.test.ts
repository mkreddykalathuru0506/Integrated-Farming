import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'InvLc123!';
const emails = { owner: 'invlc-owner@ifm.local', manager: 'invlc-manager@ifm.local' };
let ownerToken = '';
let managerToken = '';
let farmA = '';
let farmB = '';
let customerId = '';
let inv1 = ''; // → PAID
let inv2 = ''; // → CANCELLED

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, farm = farmA) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

const mkInvoice = async () =>
  request(app)
    .post('/api/farm/invoices')
    .set(h(ownerToken))
    .send({ customerId, lines: [{ description: 'Broiler birds', qty: 10, unitPricePaise: 10000, gstRateBps: 0 }] });

async function waitForAudit(where: Prisma.AuditLogWhereInput, tries = 40, delayMs = 50) {
  for (let i = 0; i < tries; i++) {
    const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

suite('Invoice lifecycle — mark-paid / void (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['InvLc Farm A', 'InvLc Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'InvLc Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'InvLc Farm B' })).body.farm.id;
    const manager = await prisma.user.findUniqueOrThrow({ where: { email: emails.manager } });
    await prisma.membership.create({ data: { userId: manager.id, farmId: farmA, role: 'MANAGER' } });
    managerToken = await login(emails.manager);

    customerId = (
      await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'InvLc Buyer' })
    ).body.customer.id;
    inv1 = (await mkInvoice()).body.invoice.id;
    inv2 = (await mkInvoice()).body.invoice.id;
  });

  afterAll(async () => {
    const owner = await prisma.user.findUnique({ where: { email: emails.owner } });
    if (owner) await prisma.auditLog.deleteMany({ where: { userId: owner.id } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('ISSUED → mark-paid → PAID; second mark-paid → 422 ALREADY_PAID', async () => {
    const res = await request(app).post(`/api/farm/invoices/${inv1}/mark-paid`).set(h(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('PAID');
    expect(res.body.invoice.totalPaise).toBe('100000');

    const again = await request(app).post(`/api/farm/invoices/${inv1}/mark-paid`).set(h(ownerToken));
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('ALREADY_PAID');
  });

  it('a PAID invoice cannot be voided (422 INVOICE_PAID)', async () => {
    const res = await request(app).post(`/api/farm/invoices/${inv1}/void`).set(h(ownerToken));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVOICE_PAID');
  });

  it('ISSUED → void → CANCELLED; P&L excludes it; numbering stays gap-free; re-void → 422', async () => {
    const res = await request(app).post(`/api/farm/invoices/${inv2}/void`).set(h(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('CANCELLED');
    const keptNumber = res.body.invoice.invoiceNumber as string;
    expect(keptNumber.endsWith('-0002')).toBe(true); // number retained, never reused

    const pnl = await request(app).get('/api/farm/invoices/pnl/farm').set(h(ownerToken));
    expect(pnl.body.revenuePaise).toBe('100000'); // only inv1 counts

    const inv3 = await mkInvoice();
    expect(inv3.status).toBe(201);
    expect((inv3.body.invoice.invoiceNumber as string).endsWith('-0003')).toBe(true); // continues past the void

    const again = await request(app).post(`/api/farm/invoices/${inv2}/void`).set(h(ownerToken));
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('mark-paid on CANCELLED/DRAFT → 422 INVALID_STATUS', async () => {
    const cancelled = await request(app).post(`/api/farm/invoices/${inv2}/mark-paid`).set(h(ownerToken));
    expect(cancelled.status).toBe(422);
    expect(cancelled.body.error.code).toBe('INVALID_STATUS');

    const draft = (await mkInvoice()).body.invoice.id;
    await prisma.invoice.update({ where: { id: draft }, data: { status: 'DRAFT' } });
    const res = await request(app).post(`/api/farm/invoices/${draft}/mark-paid`).set(h(ownerToken));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_STATUS');
  });

  it('a DRAFT invoice can be voided', async () => {
    const draft = (await mkInvoice()).body.invoice.id;
    await prisma.invoice.update({ where: { id: draft }, data: { status: 'DRAFT' } });
    const res = await request(app).post(`/api/farm/invoices/${draft}/void`).set(h(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('CANCELLED');
  });

  it('transitions are farm-scoped (404) and role-gated (MANAGER → 403)', async () => {
    const idor = await request(app).post(`/api/farm/invoices/${inv1}/mark-paid`).set(h(ownerToken, farmB));
    expect(idor.status).toBe(404);
    const rbacPaid = await request(app).post(`/api/farm/invoices/${inv1}/mark-paid`).set(h(managerToken));
    expect(rbacPaid.status).toBe(403);
    const rbacVoid = await request(app).post(`/api/farm/invoices/${inv1}/void`).set(h(managerToken));
    expect(rbacVoid.status).toBe(403);
  });

  it('audit row records the money transition (invoices.mark-paid)', async () => {
    const row = await waitForAudit({ farmId: farmA, action: 'invoices.mark-paid', entityId: inv1 });
    expect(row).not.toBeNull();
    expect(row!.entity).toBe('Invoices');
  });
});
