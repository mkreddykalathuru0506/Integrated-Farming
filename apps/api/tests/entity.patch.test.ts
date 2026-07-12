import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'EntPatch123!';
const emails = { owner: 'entpatch-owner@ifm.local', labour: 'entpatch-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farmA = '';
let farmB = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string, farm = farmA) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Entity PATCH — customers / vendors / feed items / assets (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['EntPatch Farm A', 'EntPatch Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'EntPatch Farm A', state: 'Telangana' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'EntPatch Farm B' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('customer PATCH: edits fields; rename collision → 409; issued invoices keep their GST snapshot', async () => {
    const c1 = (await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'EP Buyer One', state: 'Telangana' })).body.customer.id;
    const c2 = (await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'EP Buyer Two' })).body.customer.id;

    // Intra-state invoice (customer state == farm state) → CGST/SGST split snapshotted.
    const inv = await request(app)
      .post('/api/farm/invoices')
      .set(h(ownerToken))
      .send({ customerId: c1, lines: [{ description: 'Eggs', qty: 10, unitPricePaise: 1000, gstRateBps: 500 }] });
    expect(inv.body.invoice.cgstPaise).toBe('250');
    expect(inv.body.invoice.sgstPaise).toBe('250');

    const patched = await request(app).patch(`/api/farm/customers/${c1}`).set(h(ownerToken)).send({ state: 'Karnataka', phone: '9999900000' });
    expect(patched.status).toBe(200);
    expect(patched.body.customer.state).toBe('Karnataka');

    // The issued invoice's snapshot is untouched by the customer edit.
    const detail = await request(app).get(`/api/farm/invoices/${inv.body.invoice.id}`).set(h(ownerToken));
    expect(detail.body.invoice.placeOfSupplyState).toBe('Telangana');
    expect(detail.body.invoice.cgstPaise).toBe('250');
    expect(detail.body.invoice.igstPaise).toBe('0');

    const clash = await request(app).patch(`/api/farm/customers/${c2}`).set(h(ownerToken)).send({ name: 'EP Buyer One' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('CUSTOMER_NAME_TAKEN');

    const idor = await request(app).patch(`/api/farm/customers/${c1}`).set(h(ownerToken, farmB)).send({ phone: '1' });
    expect(idor.status).toBe(404);
    const rbac = await request(app).patch(`/api/farm/customers/${c1}`).set(h(labourToken)).send({ phone: '1' });
    expect(rbac.status).toBe(403);
  });

  it('vendor PATCH: edits gstin; rename collision → 409; cross-farm → 404', async () => {
    const v1 = (await request(app).post('/api/farm/vendors').set(h(ownerToken)).send({ name: 'EP Vendor One' })).body.vendor.id;
    const v2 = (await request(app).post('/api/farm/vendors').set(h(ownerToken)).send({ name: 'EP Vendor Two' })).body.vendor.id;

    const patched = await request(app).patch(`/api/farm/vendors/${v1}`).set(h(ownerToken)).send({ gstin: '36AABCU9603R1ZM' });
    expect(patched.status).toBe(200);
    expect(patched.body.vendor.gstin).toBe('36AABCU9603R1ZM');

    const clash = await request(app).patch(`/api/farm/vendors/${v2}`).set(h(ownerToken)).send({ name: 'EP Vendor One' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('VENDOR_NAME_TAKEN');

    const idor = await request(app).patch(`/api/farm/vendors/${v1}`).set(h(ownerToken, farmB)).send({ name: 'X' });
    expect(idor.status).toBe(404);
  });

  it('feed PATCH: edits name/threshold; stockQty is rejected (400); rename collision → 409', async () => {
    const f1 = (await request(app).post('/api/farm/feed').set(h(ownerToken)).send({ name: 'EP Starter' })).body.item.id;
    await request(app).post('/api/farm/feed').set(h(ownerToken)).send({ name: 'EP Finisher' });

    const patched = await request(app).patch(`/api/farm/feed/${f1}`).set(h(ownerToken)).send({ name: 'EP Starter Mash', reorderThreshold: 25 });
    expect(patched.status).toBe(200);
    expect(patched.body.item.name).toBe('EP Starter Mash');
    expect(patched.body.item.reorderThreshold).toBe('25');
    expect(patched.body.item.stockQty).toBe('0'); // untouched

    const stock = await request(app).patch(`/api/farm/feed/${f1}`).set(h(ownerToken)).send({ stockQty: 500 });
    expect(stock.status).toBe(400);
    expect(stock.body.error.code).toBe('VALIDATION'); // transaction-derived field is not editable

    const clash = await request(app).patch(`/api/farm/feed/${f1}`).set(h(ownerToken)).send({ name: 'EP Finisher' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('FEED_NAME_TAKEN');

    const idor = await request(app).patch(`/api/farm/feed/${f1}`).set(h(ownerToken, farmB)).send({ name: 'X' });
    expect(idor.status).toBe(404);
    const rbac = await request(app).patch(`/api/farm/feed/${f1}`).set(h(labourToken)).send({ name: 'X' });
    expect(rbac.status).toBe(403);
  });

  it('asset PATCH: status transition; unit must belong to the farm (422 INVALID_UNIT)', async () => {
    const a1 = (await request(app).post('/api/farm/assets').set(h(ownerToken)).send({ name: 'EP Genset' })).body.asset.id;
    const unitB = (
      await request(app).post('/api/farm/units').set(h(ownerToken, farmB)).send({ name: 'EP Shed B', type: 'POULTRY' })
    ).body.unit.id;

    const patched = await request(app)
      .patch(`/api/farm/assets/${a1}`)
      .set(h(ownerToken))
      .send({ status: 'UNDER_REPAIR', purchaseCostPaise: 2500000 });
    expect(patched.status).toBe(200);
    expect(patched.body.asset.status).toBe('UNDER_REPAIR');
    expect(patched.body.asset.purchaseCostPaise).toBe('2500000');

    const badUnit = await request(app).patch(`/api/farm/assets/${a1}`).set(h(ownerToken)).send({ unitId: unitB });
    expect(badUnit.status).toBe(422);
    expect(badUnit.body.error.code).toBe('INVALID_UNIT');

    const idor = await request(app).patch(`/api/farm/assets/${a1}`).set(h(ownerToken, farmB)).send({ name: 'X' });
    expect(idor.status).toBe(404);
    const rbac = await request(app).patch(`/api/farm/assets/${a1}`).set(h(labourToken)).send({ name: 'X' });
    expect(rbac.status).toBe(403);
  });
});
