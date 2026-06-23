import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'LoanTest123!';
const emails = { owner: 'loantest-owner@ifm.local', labour: 'loantest-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farm = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: pw })).body.accessToken as string;
const h = (t: string) => ({ Authorization: `Bearer ${t}`, 'X-Farm-Id': farm });
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

suite('Loan/EMI + insurance (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: 'Loan Farm' } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farm = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'Loan Farm' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farm, role: 'LABOUR' } });
    labourToken = await login(emails.labour);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: farm } });
  });

  it('creates a loan (paise) + records a payment', async () => {
    const loan = await request(app).post('/api/farm/loans').set(h(ownerToken)).send({
      lender: 'NABARD',
      principalPaise: 50000000,
      emiAmountPaise: 500000,
      startDate: new Date().toISOString(),
      nextDueDate: inDays(3),
    });
    expect(loan.status).toBe(201);
    expect(loan.body.loan.principalPaise).toBe('50000000');
    const pay = await request(app).post(`/api/farm/loans/${loan.body.loan.id}/payments`).set(h(ownerToken)).send({ amountPaise: 500000 });
    expect(pay.status).toBe(201);
    expect(pay.body.payment.amountPaise).toBe('500000');
  });

  it('creates an insurance policy', async () => {
    const res = await request(app).post('/api/farm/insurance').set(h(ownerToken)).send({
      provider: 'Oriental',
      type: 'LIVESTOCK',
      premiumPaise: 250000,
      startDate: new Date().toISOString(),
      endDate: inDays(20),
    });
    expect(res.status).toBe(201);
    expect(res.body.policy.premiumPaise).toBe('250000');
  });

  it('reminders surface EMI due (7d) + policy expiring (30d)', async () => {
    const res = await request(app).get('/api/farm/finance/reminders').set(h(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.emiDue.length).toBeGreaterThan(0); // due in 3 days
    expect(res.body.policiesExpiring.length).toBeGreaterThan(0); // expires in 20 days
  });

  it('LABOUR cannot create a loan (403)', async () => {
    const res = await request(app).post('/api/farm/loans').set(h(labourToken)).send({ lender: 'X', principalPaise: 1, startDate: new Date().toISOString() });
    expect(res.status).toBe(403);
  });
});
