import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { PdfKitInvoicePdf, invoiceHeaderLines } from '../src/invoices/pdf';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'InvTest123!';
const emails = { owner: 'invtest-owner@ifm.local', labour: 'invtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let custIntra = '';
let custInter = '';
let batchId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

const FOR_PDF = {
  invoiceNumber: 'INV-2026-27-0001',
  issueDate: new Date('2026-06-23T00:00:00.000Z'),
  fssaiLicenseNo: '12345678901234',
  sellerGstin: '36ABCDE1234F1Z5',
  customerName: 'Acme',
  customerGstin: null,
  subtotalPaise: 500000n,
  cgstPaise: 12500n,
  sgstPaise: 12500n,
  igstPaise: 0n,
  totalPaise: 525000n,
  lines: [{ description: 'Eggs', hsnSac: '0407', qty: '100', unitPricePaise: 5000n, gstRateBps: 500, lineTotalPaise: 525000n }],
};

describe('invoice PDF adapter', () => {
  it('renders a %PDF document', async () => {
    const buf = await new PdfKitInvoicePdf().render(FOR_PDF);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('header prints seller GSTIN + FSSAI (both legally required)', () => {
    const lines = invoiceHeaderLines(FOR_PDF);
    expect(lines).toContain('GSTIN: 36ABCDE1234F1Z5');
    expect(lines).toContain('FSSAI License: 12345678901234');
  });

  it('omits the GSTIN line when the seller has no GSTIN', () => {
    expect(invoiceHeaderLines({ ...FOR_PDF, sellerGstin: null }).some((l) => l.startsWith('GSTIN:'))).toBe(false);
  });
});

suite('Invoices + GST + P&L (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Invoice Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Invoice Farm', state: 'Telangana' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    await request(app).put('/api/farm/settings').set(h(ownerToken)).send({ fssaiLicenseNo: '12345678901234' });
    custIntra = (await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'Local Buyer', state: 'Telangana' })).body.customer.id;
    custInter = (await request(app).post('/api/farm/customers').set(h(ownerToken)).send({ name: 'Outstate Buyer', state: 'Karnataka' })).body.customer.id;

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'INV-BR', initialCount: 100 })).body.batch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('intra-state invoice splits CGST/SGST, snapshots FSSAI, sequential number', async () => {
    const res = await request(app).post('/api/farm/invoices').set(h(ownerToken)).send({
      customerId: custIntra,
      lines: [{ description: 'Eggs', hsnSac: '0407', qty: 100, unitPricePaise: 5000, gstRateBps: 500 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.invoice.subtotalPaise).toBe('500000');
    expect(res.body.invoice.cgstPaise).toBe('12500');
    expect(res.body.invoice.sgstPaise).toBe('12500');
    expect(res.body.invoice.igstPaise).toBe('0');
    expect(res.body.invoice.totalPaise).toBe('525000');
    expect(res.body.invoice.fssaiLicenseNo).toBe('12345678901234');
    expect(res.body.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{2}-0001$/);
  });

  it('inter-state invoice uses IGST', async () => {
    const res = await request(app).post('/api/farm/invoices').set(h(ownerToken)).send({
      customerId: custInter,
      lines: [{ description: 'Broiler', qty: 100, unitPricePaise: 5000, gstRateBps: 500 }],
    });
    expect(res.body.invoice.igstPaise).toBe('25000');
    expect(res.body.invoice.cgstPaise).toBe('0');
    expect(res.body.invoice.invoiceNumber).toMatch(/-0002$/); // sequential
  });

  it('serves a PDF', async () => {
    const list = await request(app).get('/api/farm/invoices').set(h(ownerToken));
    const id = list.body.invoices[0].id;
    const res = await request(app).get(`/api/farm/invoices/${id}/pdf`).set(h(ownerToken)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('batch P&L = invoice revenue − cost; LABOUR create → 403', async () => {
    await request(app).post('/api/farm/expenses').set(h(ownerToken)).send({ category: 'MEDICINE', amountPaise: 100000, batchId });
    await request(app).post('/api/farm/invoices').set(h(ownerToken)).send({
      customerId: custIntra,
      lines: [{ description: 'Birds', qty: 1, unitPricePaise: 200000, gstRateBps: 0, batchId }],
    });
    const pnl = await request(app).get(`/api/farm/invoices/pnl/batch?batchId=${batchId}`).set(h(ownerToken));
    expect(pnl.body.revenuePaise).toBe('200000');
    expect(pnl.body.costPaise).toBe('100000');
    expect(pnl.body.profitPaise).toBe('100000');

    const lab = await request(app).post('/api/farm/invoices').set(h(labourToken)).send({ customerId: custIntra, lines: [{ description: 'x', qty: 1, unitPricePaise: 1, gstRateBps: 0 }] });
    expect(lab.status).toBe(403);
  });
});
