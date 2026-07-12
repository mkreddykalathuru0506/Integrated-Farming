import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const oldPassword = 'OldPass123!';
const newPassword = 'NewPass456!';

function uniqueEmail(): string {
  return `otp-chpw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@t.io`;
}

const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('change password (integration)', () => {
  it('requires auth and the correct current password', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ email, name: 'ChPw Test', password: oldPassword });
    const login = await request(app).post('/api/auth/login').send({ email, password: oldPassword });

    const noAuth = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: oldPassword, newPassword, refreshToken: login.body.refreshToken });
    expect(noAuth.status).toBe(401);

    const wrongCurrent = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: 'not-the-password', newPassword, refreshToken: login.body.refreshToken });
    expect(wrongCurrent.status).toBe(401);
    expect(wrongCurrent.body.error.code).toBe('INVALID_CREDENTIALS');

    // Password unchanged after the failures.
    const still = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
    expect(still.status).toBe(200);
  });

  it('changes the password and revokes every session except the caller’s', async () => {
    const email = uniqueEmail();
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, name: 'ChPw Test', password: oldPassword });
    const userId = reg.body.user.id as string;

    const sessionA = await request(app).post('/api/auth/login').send({ email, password: oldPassword });
    const sessionB = await request(app).post('/api/auth/login').send({ email, password: oldPassword });

    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${sessionA.body.accessToken}`)
      .send({
        currentPassword: oldPassword,
        newPassword,
        refreshToken: sessionA.body.refreshToken,
      });
    expect(change.status).toBe(200);
    expect(change.body).toEqual({ ok: true });

    // The other session's refresh token is dead; the caller's still rotates.
    const deadB = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: sessionB.body.refreshToken });
    expect(deadB.status).toBe(401);
    const aliveA = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: sessionA.body.refreshToken });
    expect(aliveA.status).toBe(200);

    // New password works; old one doesn't.
    expect((await request(app).post('/api/auth/login').send({ email, password: newPassword })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email, password: oldPassword })).status).toBe(401);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'user.password.change', entityId: userId },
    });
    expect(auditRow).not.toBeNull();
  });
});
