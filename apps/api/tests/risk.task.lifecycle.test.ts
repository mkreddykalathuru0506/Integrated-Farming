import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

const pw = 'RiskTask123!';
const emails = { owner: 'risktask-owner@ifm.local', labour: 'risktask-labour@ifm.local' };
let ownerToken = '';
let labourToken = '';
let farmA = '';
let farmB = '';
let riskId = '';
let workerA = '';
let workerB = '';
let task1 = '';
let task2 = '';

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

suite('Risk resolve + task assignment (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { name: { in: ['RiskTask Farm A', 'RiskTask Farm B'] } } });
    for (const e of Object.values(emails)) {
      await request(app).post('/api/auth/register').send({ email: e, name: e, password: pw });
    }
    ownerToken = await login(emails.owner);
    farmA = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'RiskTask Farm A' })).body.farm.id;
    farmB = (await request(app).post('/api/farms').set('Authorization', `Bearer ${ownerToken}`).send({ name: 'RiskTask Farm B' })).body.farm.id;
    const labour = await prisma.user.findUniqueOrThrow({ where: { email: emails.labour } });
    await prisma.membership.create({ data: { userId: labour.id, farmId: farmA, role: 'LABOUR' } });
    labourToken = await login(emails.labour);

    riskId = (
      await prisma.riskFlag.create({
        data: { farmId: farmA, type: 'OTHER', severity: 'WARNING', reason: 'test flag', dedupeKey: 'RISKTASK:test' },
        select: { id: true },
      })
    ).id;

    workerA = (await request(app).post('/api/farm/workers').set(h(ownerToken)).send({ name: 'RT Worker A' })).body.worker.id;
    workerB = (await request(app).post('/api/farm/workers').set(h(ownerToken, farmB)).send({ name: 'RT Worker B' })).body.worker.id;
    task1 = (
      await request(app).post('/api/farm/tasks').set(h(ownerToken)).send({ title: 'RT feed morning', taskType: 'FEEDING', dueDate: '2026-07-11' })
    ).body.task.id;
    task2 = (
      await request(app).post('/api/farm/tasks').set(h(ownerToken)).send({ title: 'RT clean shed', taskType: 'CLEANING', dueDate: '2026-07-11' })
    ).body.task.id;
  });

  afterAll(async () => {
    const owner = await prisma.user.findUnique({ where: { email: emails.owner } });
    if (owner) await prisma.auditLog.deleteMany({ where: { userId: owner.id } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.farm.deleteMany({ where: { id: { in: [farmA, farmB] } } });
  });

  it('resolve: OPEN → RESOLVED, ack fields set (resolve implies ack); idempotent repeat', async () => {
    const res = await request(app).post(`/api/farm/risk/${riskId}/resolve`).set(h(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.risk.status).toBe('RESOLVED');
    expect(res.body.risk.acknowledgedAt).not.toBeNull();

    const row = await prisma.riskFlag.findUniqueOrThrow({ where: { id: riskId } });
    expect(row.acknowledgedBy).toBeTruthy();
    const firstAck = row.acknowledgedAt;

    const again = await request(app).post(`/api/farm/risk/${riskId}/resolve`).set(h(ownerToken));
    expect(again.status).toBe(200);
    expect(again.body.risk.status).toBe('RESOLVED');
    const rowAfter = await prisma.riskFlag.findUniqueOrThrow({ where: { id: riskId } });
    expect(rowAfter.acknowledgedAt?.getTime()).toBe(firstAck?.getTime()); // unchanged

    const open = await request(app).get('/api/farm/risk?status=OPEN').set(h(ownerToken));
    expect(open.body.risks.map((r: { id: string }) => r.id)).not.toContain(riskId);
  });

  it('resolve is farm-scoped (404) and role-gated (LABOUR → 403)', async () => {
    const idor = await request(app).post(`/api/farm/risk/${riskId}/resolve`).set(h(ownerToken, farmB));
    expect(idor.status).toBe(404);
    const rbac = await request(app).post(`/api/farm/risk/${riskId}/resolve`).set(h(labourToken));
    expect(rbac.status).toBe(403);
  });

  it('assign + filter roundtrip: ?assigneeId=<id> and ?assigneeId=none', async () => {
    const res = await request(app).patch(`/api/farm/tasks/${task1}/assign`).set(h(ownerToken)).send({ workerId: workerA });
    expect(res.status).toBe(200);
    expect(res.body.task.assignedWorkerId).toBe(workerA);

    const mine = await request(app).get(`/api/farm/tasks?assigneeId=${workerA}`).set(h(ownerToken));
    expect(mine.body.tasks.map((t: { id: string }) => t.id)).toEqual([task1]);

    const unassigned = await request(app).get('/api/farm/tasks?assigneeId=none').set(h(ownerToken));
    const ids = unassigned.body.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(task2);
    expect(ids).not.toContain(task1);
  });

  it('rejects another farm\'s worker (422 INVALID_WORKER); null unassigns', async () => {
    const bad = await request(app).patch(`/api/farm/tasks/${task1}/assign`).set(h(ownerToken)).send({ workerId: workerB });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('INVALID_WORKER');

    const clear = await request(app).patch(`/api/farm/tasks/${task1}/assign`).set(h(ownerToken)).send({ workerId: null });
    expect(clear.status).toBe(200);
    expect(clear.body.task.assignedWorkerId).toBeNull();
  });

  it('assign is farm-scoped (404) and role-gated: LABOUR cannot assign but can complete', async () => {
    const idor = await request(app).patch(`/api/farm/tasks/${task1}/assign`).set(h(ownerToken, farmB)).send({ workerId: null });
    expect(idor.status).toBe(404);
    const rbac = await request(app).patch(`/api/farm/tasks/${task1}/assign`).set(h(labourToken)).send({ workerId: null });
    expect(rbac.status).toBe(403);

    const complete = await request(app).post(`/api/farm/tasks/${task2}/complete`).set(h(labourToken)).send({});
    expect(complete.status).toBe(200);
    expect(complete.body.task.status).toBe('DONE');
  });

  it('audit rows exist for the new mutation families (risk.resolve, tasks.assign)', async () => {
    const resolve = await waitForAudit({ farmId: farmA, action: 'risk.resolve', entityId: riskId });
    expect(resolve).not.toBeNull();
    const assign = await waitForAudit({ farmId: farmA, action: 'tasks.assign', entityId: task1 });
    expect(assign).not.toBeNull();
    expect(assign!.entity).toBe('Tasks');
  });
});
