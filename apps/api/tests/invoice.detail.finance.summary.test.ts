import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { istFyStart, istMonthKey, istMonthKeysBetween } from '../src/finance/summary';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

// ---------- pure IST helpers (no DB) ----------
describe('istMonthKey / istFyStart (pure)', () => {
  it('buckets by Asia/Kolkata month across the midnight boundary', () => {
    // 30 Apr 23:59 IST = 30 Apr 18:29 UTC → April
    expect(istMonthKey(new Date('2026-04-30T18:29:00.000Z'))).toBe('2026-04');
    // 1 May 00:01 IST = 30 Apr 18:31 UTC → May
    expect(istMonthKey(new Date('2026-04-30T18:31:00.000Z'))).toBe('2026-05');
    // 1 Jan 00:00:00 IST exactly
    expect(istMonthKey(new Date('2025-12-31T18:30:00.000Z'))).toBe('2026-01');
  });

  it('istFyStart returns 1 April 00:00 IST of the current Indian FY', () => {
    // July 2026 → FY 2026-27 → 1 Apr 2026 00:00 IST = 31 Mar 2026 18:30 UTC
    expect(istFyStart(new Date('2026-07-11T00:00:00.000Z')).toISOString()).toBe('2026-03-31T18:30:00.000Z');
    // Feb 2026 → FY 2025-26 → 1 Apr 2025
    expect(istFyStart(new Date('2026-02-01T00:00:00.000Z')).toISOString()).toBe('2025-03-31T18:30:00.000Z');
  });

  it('istMonthKeysBetween is inclusive and emits every month in the window', () => {
    expect(istMonthKeysBetween(new Date('2026-04-05T00:00:00.000Z'), new Date('2026-06-20T00:00:00.000Z'))).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });
});

// ---------- integration ----------
const pw = 'FinSum123!';
const email = 'finsum-owner@ifm.local';
let token = '';
let farmA = '';
let farmB = '';
let invoiceId = '';
let customerId = '';

const hA = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmA });
const hB = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farmB });

suite('Invoice detail + finance monthly summary (slice 11.5a)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: { in: ['FinSum Farm A', 'FinSum Farm B'] } } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken;
    farmA = (
      await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'FinSum Farm A', state: 'Telangana' })
    ).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'FinSum Farm B' })).body.farm.id;

    customerId = (
      await request(app).post('/api/farm/customers').set(hA()).send({ name: 'FinSum Buyer', gstin: '36ABCDE1234F1Z5', state: 'Telangana' })
    ).body.customer.id;

    // Revenue: Apr 2026 invoice ₹2,000 (200000p, GST 5% intra-state) + May 2026 invoice ₹180 (18000p, no GST)
    invoiceId = (
      await request(app).post('/api/farm/invoices').set(hA()).send({
        customerId,
        issueDate: '2026-04-15T10:00:00.000Z',
        notes: 'april lot',
        lines: [{ description: 'Broiler', hsnSac: '0207', qty: 10, unitPricePaise: 20000, gstRateBps: 500, batchId: undefined }],
      })
    ).body.invoice.id;
    await request(app).post('/api/farm/invoices').set(hA()).send({
      customerId,
      issueDate: '2026-05-02T10:00:00.000Z',
      lines: [{ description: 'Eggs', qty: 30, unitPricePaise: 600, gstRateBps: 0 }],
    });

    // Expenses: Apr 40000p + Jun 10000p (May left empty → zero bucket)
    await request(app).post('/api/farm/expenses').set(hA()).send({ category: 'FEED', amountPaise: 40000, occurredAt: '2026-04-20T10:00:00.000Z' });
    await request(app).post('/api/farm/expenses').set(hA()).send({ category: 'UTILITIES', amountPaise: 10000, occurredAt: '2026-06-10T10:00:00.000Z' });

    // Feed cost: purchase 100kg @300p/kg, consume 40kg in Apr → 12000p CONSUMPTION
    const sp = (await request(app).get('/api/farm/species').set(hA())).body.species;
    const chicken = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const batch = (await request(app).post('/api/farm/batches').set(hA()).send({ speciesId: chicken, code: 'FS-B1', initialCount: 100 })).body.batch.id;
    const item = (await request(app).post('/api/farm/feed').set(hA()).send({ name: 'FS Starter', unit: 'kg' })).body.item.id;
    await request(app).post('/api/farm/feed/purchase').set(hA()).send({ feedItemId: item, qty: 100, unitPricePaise: 300, occurredAt: '2026-04-18T10:00:00.000Z' });
    await request(app).post('/api/farm/feed/consume').set(hA()).send({ feedItemId: item, batchId: batch, qty: 40, occurredAt: '2026-04-22T10:00:00.000Z' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('GET /invoices/:id returns the detail DTO (customer, lines, GST split, strings)', async () => {
    const res = await request(app).get(`/api/farm/invoices/${invoiceId}`).set(hA());
    expect(res.status).toBe(200);
    const inv = res.body.invoice;
    expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-\d{2}-\d{4}$/);
    expect(inv.customer).toEqual({ id: customerId, name: 'FinSum Buyer', gstin: '36ABCDE1234F1Z5', state: 'Telangana' });
    expect(inv.placeOfSupplyState).toBe('Telangana');
    expect(inv.notes).toBe('april lot');
    expect(inv.lines).toHaveLength(1);
    const line = inv.lines[0];
    expect(line.qty).toBe('10');
    expect(line.unitPricePaise).toBe('20000');
    expect(line.taxablePaise).toBe('200000');
    expect(line.gstPaise).toBe('10000'); // 5% of 200000
    expect(line.lineTotalPaise).toBe('210000');
    expect(line.hsnSac).toBe('0207');
    // intra-state → CGST/SGST split, money as strings
    expect(inv.subtotalPaise).toBe('200000');
    expect(inv.cgstPaise).toBe('5000');
    expect(inv.sgstPaise).toBe('5000');
    expect(inv.igstPaise).toBe('0');
    expect(inv.totalPaise).toBe('210000');
  });

  it('invoice detail is farm-scoped: other farm → 404, unknown id → 404', async () => {
    const idor = await request(app).get(`/api/farm/invoices/${invoiceId}`).set(hB());
    expect(idor.status).toBe(404);
    expect((await request(app).get('/api/farm/invoices/nope').set(hA())).status).toBe(404);
  });

  it('GET /finance/summary buckets by IST month with zeros for empty months', async () => {
    const res = await request(app)
      .get('/api/farm/finance/summary?from=2026-04-01T00:00:00.000Z&to=2026-06-30T00:00:00.000Z')
      .set(hA());
    expect(res.status).toBe(200);
    expect(res.body.granularity).toBe('month');
    expect(res.body.buckets.map((b: { month: string }) => b.month)).toEqual(['2026-04', '2026-05', '2026-06']);

    const [apr, may, jun] = res.body.buckets;
    expect(apr).toEqual({
      month: '2026-04',
      revenuePaise: '210000',
      expensePaise: '40000',
      feedCostPaise: '12000',
      profitPaise: '158000',
    });
    expect(may).toEqual({
      month: '2026-05',
      revenuePaise: '18000',
      expensePaise: '0',
      feedCostPaise: '0',
      profitPaise: '18000',
    });
    expect(jun).toEqual({
      month: '2026-06',
      revenuePaise: '0',
      expensePaise: '10000',
      feedCostPaise: '0',
      profitPaise: '-10000',
    });
  });

  it('summary defaults to the current Indian FY and is farm-scoped', async () => {
    const def = await request(app).get('/api/farm/finance/summary').set(hA());
    expect(def.status).toBe(200);
    const now = new Date();
    expect(def.body.buckets[0].month).toBe(istMonthKey(istFyStart(now))); // FY starts in April (IST)
    expect(def.body.buckets[def.body.buckets.length - 1].month).toBe(istMonthKey(now));

    const other = await request(app)
      .get('/api/farm/finance/summary?from=2026-04-01T00:00:00.000Z&to=2026-06-30T00:00:00.000Z')
      .set(hB());
    for (const b of other.body.buckets) {
      expect(b.revenuePaise).toBe('0');
      expect(b.expensePaise).toBe('0');
      expect(b.feedCostPaise).toBe('0');
    }
    expect((await request(app).get('/api/farm/finance/summary?granularity=week').set(hA())).status).toBe(400);
  });
});
