import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'ProcTest123!';
const emails = { owner: 'proctest-owner@ifm.local', labour: 'proctest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let batchId = '';
let medBatchId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Processing → lots + traceability + withdrawal gate (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Proc Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Proc Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    batchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'PROC-BR', initialCount: 100 })).body.batch.id;
    medBatchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'PROC-MED', initialCount: 50 })).body.batch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('processes a clean batch → lots with auto code/QR; decrements batch count', async () => {
    const res = await request(app)
      .post('/api/farm/processing')
      .set(h(ownerToken))
      .send({
        sourceBatchId: batchId,
        inputCount: 40,
        lots: [
          { productName: 'Whole dressed chicken', state: 'FRESH', quantityKg: 60 },
          { productName: 'Chicken breast', state: 'FROZEN', quantityKg: 15 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.run.lots).toHaveLength(2);
    expect(res.body.run.lots[0].lotCode).toMatch(/^IFM-L-/);
    expect(res.body.run.lots[0].qrCode).toMatch(/^IFM-L-/);
    expect(res.body.run.lots[0].quantityKg).toBe('60');

    const batch = (await request(app).get('/api/farm/batches').set(h(ownerToken))).body.batches.find((b: { id: string }) => b.id === batchId);
    expect(batch.currentCount).toBe(60); // 100 − 40
  });

  it('BLOCKS processing a batch under active medication withdrawal (§6 hard rule)', async () => {
    await request(app)
      .post('/api/farm/health/medications')
      .set(h(ownerToken))
      .send({ batchId: medBatchId, drugName: 'Enrofloxacin', withdrawalDays: 14 });

    const res = await request(app)
      .post('/api/farm/processing')
      .set(h(ownerToken))
      .send({ sourceBatchId: medBatchId, inputCount: 10, lots: [{ productName: 'x', quantityKg: 5 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('WITHDRAWAL_ACTIVE');
  });

  it('traces a lot back to its source batch + species', async () => {
    const lots = (await request(app).get('/api/farm/lots').set(h(ownerToken))).body.lots;
    const lot = lots.find((l: { sourceBatchId: string }) => l.sourceBatchId === batchId);
    const trace = await request(app).get(`/api/farm/lots/${lot.id}/trace`).set(h(ownerToken));
    expect(trace.status).toBe(200);
    expect(trace.body.sourceBatch.code).toBe('PROC-BR');
    expect(trace.body.sourceBatch.species.name).toBeTruthy();
    expect(trace.body.processingRun.id).toBeTruthy();
  });

  it('rejects inputCount over the batch count, and LABOUR processing → 403', async () => {
    const over = await request(app)
      .post('/api/farm/processing')
      .set(h(ownerToken))
      .send({ sourceBatchId: batchId, inputCount: 9999, lots: [{ productName: 'x', quantityKg: 1 }] });
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe('INSUFFICIENT_COUNT');

    const lab = await request(app)
      .post('/api/farm/processing')
      .set(h(labourToken))
      .send({ sourceBatchId: batchId, inputCount: 1, lots: [{ productName: 'x', quantityKg: 1 }] });
    expect(lab.status).toBe(403);
  });

  it('requires a source (422 when neither batch nor animal given)', async () => {
    const res = await request(app).post('/api/farm/processing').set(h(ownerToken)).send({ lots: [{ productName: 'x', quantityKg: 1 }] });
    expect(res.status).toBe(400); // zod refine → validation error
  });
});
