import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'VaxTest123!';
const emails = { owner: 'vaxtest-owner@ifm.local', labour: 'vaxtest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';
let batchId = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });

suite('Vaccination schedules (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Vax Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Vax Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    const sp = (await request(app).get('/api/farm/species').set(h(ownerToken))).body.species;
    const chickenId = sp.find((s: { code: string }) => s.code === 'CHICKEN').id;
    const acquiredAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    batchId = (await request(app).post('/api/farm/batches').set(h(ownerToken)).send({ speciesId: chickenId, code: 'VAX-BR', initialCount: 50, acquiredAt })).body.batch.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
    await prisma.$disconnect();
  });

  it('a 30-day-old batch has overdue vaccinations due + Fowl Pox upcoming', async () => {
    const res = await request(app).get(`/api/farm/health/vaccinations?batchId=${batchId}`).set(h(ownerToken));
    expect(res.status).toBe(200);
    const dueNames = res.body.due.map((x: { vaccineName: string }) => x.vaccineName);
    expect(dueNames).toContain("Marek's");
    expect(dueNames).toContain('IBD (Gumboro)');
    const upcoming = res.body.upcoming.map((x: { vaccineName: string }) => x.vaccineName);
    expect(upcoming).toContain('Fowl Pox');
  });

  it('recording a dose moves it from due to done', async () => {
    const rec = await request(app).post('/api/farm/health/vaccinations').set(h(ownerToken)).send({ batchId, vaccineName: "Marek's" });
    expect(rec.status).toBe(201);
    const res = await request(app).get(`/api/farm/health/vaccinations?batchId=${batchId}`).set(h(ownerToken));
    expect(res.body.done.map((x: { vaccineName: string }) => x.vaccineName)).toContain("Marek's");
    expect(res.body.due.map((x: { vaccineName: string }) => x.vaccineName)).not.toContain("Marek's");
  });

  it('LABOUR cannot record a vaccination (403)', async () => {
    const res = await request(app).post('/api/farm/health/vaccinations').set(h(labourToken)).send({ batchId, vaccineName: 'IBD (Gumboro)' });
    expect(res.status).toBe(403);
  });
});
