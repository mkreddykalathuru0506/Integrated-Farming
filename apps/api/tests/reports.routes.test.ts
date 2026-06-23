import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { renderSummaryPdf, renderSummaryXlsx } from '../src/reports/render';
import type { ReportSummary } from '../src/reports/data';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const SAMPLE: ReportSummary = {
  farm: { name: 'Demo', state: 'Telangana', fssaiLicenseNo: '12345678901234' },
  range: { from: null, to: null },
  generatedAt: new Date('2026-06-24T00:00:00.000Z'),
  financial: { revenuePaise: '500000', costPaise: '300000', profitPaise: '200000' },
  livestock: { activeBatches: 3, totalBirds: 250, mortalityEvents: 2, mortalityCount: 5 },
  feed: { consumptionKg: 120, consumptionCostPaise: '60000' },
  market: [{ commodity: 'Broiler', pricePaise: '10000', unit: 'kg' }],
  risks: { open: 1, critical: 0 },
};

describe('report renderers', () => {
  it('renders a %PDF document', async () => {
    const buf = await renderSummaryPdf(SAMPLE);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders an .xlsx (PK zip) workbook', async () => {
    const buf = await renderSummaryXlsx(SAMPLE);
    expect(buf.subarray(0, 2).toString()).toBe('PK'); // zip/xlsx magic bytes
  });
});

const pw = 'RptTest123!';
const email = 'rpttest-owner@ifm.local';
let token = '';
let farm = '';
const h = () => ({ Authorization: `Bearer ${token}`, 'X-Farm-Id': farm });

const getBuffer = (path: string) =>
  request(app)
    .get(path)
    .set(h())
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });

suite('Reports endpoints (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { name: 'Report Farm' } });
    await request(app).post('/api/auth/register').send({ email, name: email, password: pw });
    token = (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken;
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${token}`).send({ name: 'Report Farm' })).body.farm.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('serves a PDF summary', async () => {
    const res = await getBuffer('/api/farm/reports/summary.pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('serves an .xlsx summary', async () => {
    const res = await getBuffer('/api/farm/reports/summary.xlsx');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });
});
