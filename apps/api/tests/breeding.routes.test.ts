import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'BreedTest123!';
const emails = { owner: 'breedtest-owner@ifm.local', labour: 'breedtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let cattleId = '';
let damId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Breeding records (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Breed Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Breed Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    cattleId = sp.find((s: { code: string }) => s.code === 'CATTLE').id;
    damId = (await request(app).post('/api/farm/animals').set(h(ownerToken)).send({ speciesId: cattleId, tagNumber: 'DAM-1', sex: 'FEMALE' })).body.animal.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  let recId = '';
  it('auto-computes expected due date from species gestation (283d for cattle)', async () => {
    const breedingDate = '2026-06-01T00:00:00.000Z';
    const res = await request(app).post('/api/farm/breeding').set(h(ownerToken)).send({ speciesId: cattleId, damId, breedingDate });
    expect(res.status).toBe(201);
    const days = (new Date(res.body.record.expectedDueDate).getTime() - new Date(breedingDate).getTime()) / 86_400_000;
    expect(days).toBe(283);
    recId = res.body.record.id;
  });

  it('respects an explicit expectedDueDate override', async () => {
    const res = await request(app).post('/api/farm/breeding').set(h(ownerToken)).send({
      speciesId: cattleId,
      breedingDate: '2026-06-01T00:00:00.000Z',
      expectedDueDate: '2026-09-01T00:00:00.000Z',
    });
    expect(res.body.record.expectedDueDate).toContain('2026-09-01');
  });

  it('updates to COMPLETED with offspring count', async () => {
    const res = await request(app).patch(`/api/farm/breeding/${recId}`).set(h(ownerToken)).send({ status: 'COMPLETED', offspringCount: 1 });
    expect(res.body.record.status).toBe('COMPLETED');
    expect(res.body.record.offspringCount).toBe(1);
  });

  it('LABOUR cannot create a breeding record (403)', async () => {
    const res = await request(app).post('/api/farm/breeding').set(h(labourToken)).send({ speciesId: cattleId, breedingDate: '2026-06-01T00:00:00.000Z' });
    expect(res.status).toBe(403);
  });
});
