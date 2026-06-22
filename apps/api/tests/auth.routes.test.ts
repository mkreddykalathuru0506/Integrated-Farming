import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const app = createApp();
const email = 'authtest@ifm.local';
const password = 'TestPass123!';

// Integration tests need a database; skip cleanly when DATABASE_URL is absent.
const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('auth flow (integration)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('register → login → me → refresh(rotate) → logout', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email, name: 'Auth Test', password });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe(email);

    const dup = await request(app).post('/api/auth/register').send({ email, name: 'Auth Test', password });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken } = login.body;
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    const noAuth = await request(app).get('/api/auth/me');
    expect(noAuth.status).toBe(401);

    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).toBeTruthy();
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);

    // Old refresh token was rotated → reuse must fail.
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(401);

    const newRefresh = refreshed.body.refreshToken as string;
    const out = await request(app).post('/api/auth/logout').send({ refreshToken: newRefresh });
    expect(out.status).toBe(200);

    const afterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken: newRefresh });
    expect(afterLogout.status).toBe(401);
  });
});
