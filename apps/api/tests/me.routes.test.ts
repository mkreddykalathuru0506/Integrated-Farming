import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const password = 'TestPass123!';

function uniqueEmail(): string {
  return `otp-me-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@t.io`;
}

function uniquePhone(): string {
  return `+91${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`;
}

async function registerAndLogin(userAgent = 'vitest-agent/1.0') {
  const email = uniqueEmail();
  await request(app).post('/api/auth/register').send({ email, name: 'Me Test', password });
  const login = await request(app)
    .post('/api/auth/login')
    .set('User-Agent', userAgent)
    .send({ email, password });
  expect(login.status).toBe(200);
  return { email, ...login.body } as {
    email: string;
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  };
}

const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('PATCH /api/me (integration)', () => {
  it('updates name + locale and the change is visible on /api/auth/me', async () => {
    const s = await registerAndLogin();
    const patch = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${s.accessToken}`)
      .send({ name: 'Renamed User', locale: 'hi' });
    expect(patch.status).toBe(200);
    expect(patch.body.user).toMatchObject({ name: 'Renamed User', locale: 'hi', email: s.email });

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${s.accessToken}`);
    expect(me.body.user.name).toBe('Renamed User');
    expect(me.body.user.locale).toBe('hi');
  });

  it('rejects an invalid phone and a duplicate phone (409 PHONE_TAKEN)', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const phone = uniquePhone();

    const badShape = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ phone: 'not-a-phone' });
    expect(badShape.status).toBe(400);
    expect(badShape.body.error.code).toBe('VALIDATION');

    const setA = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ phone });
    expect(setA.status).toBe(200);

    const dup = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ phone });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PHONE_TAKEN');
  });

  it('requires auth', async () => {
    const res = await request(app).patch('/api/me').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });
});

suite('sessions (integration)', () => {
  it('lists active sessions with ip + userAgent, newest first, incl. sessionId from login', async () => {
    const s = await registerAndLogin('vitest-agent/1.0');
    expect(s.sessionId).toBeTruthy();

    const list = await request(app)
      .get('/api/me/sessions')
      .set('Authorization', `Bearer ${s.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(1);
    const session = list.body.sessions[0];
    expect(session.id).toBe(s.sessionId);
    expect(session.userAgent).toBe('vitest-agent/1.0');
    expect(session.ip).toBeTruthy();
    expect(session.createdAt).toBeTruthy();
  });

  it('DELETE /api/me/sessions/:id revokes that session only; foreign ids are 404', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ email, name: 'Me Test', password });
    const a = await request(app).post('/api/auth/login').send({ email, password });
    const b = await request(app).post('/api/auth/login').send({ email, password });

    // Another user must not be able to touch these sessions (no IDOR → plain 404).
    const stranger = await registerAndLogin();
    const foreign = await request(app)
      .delete(`/api/me/sessions/${b.body.sessionId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(foreign.status).toBe(404);

    const kill = await request(app)
      .delete(`/api/me/sessions/${b.body.sessionId}`)
      .set('Authorization', `Bearer ${a.body.accessToken}`);
    expect(kill.status).toBe(200);

    const deadB = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: b.body.refreshToken });
    expect(deadB.status).toBe(401);
    const aliveA = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: a.body.refreshToken });
    expect(aliveA.status).toBe(200);
    expect(aliveA.body.sessionId).toBeTruthy(); // refresh responses carry the new session id
  });

  it('revoke-others keeps only the presenting session', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ email, name: 'Me Test', password });
    const s1 = await request(app).post('/api/auth/login').send({ email, password });
    const s2 = await request(app).post('/api/auth/login').send({ email, password });
    const s3 = await request(app).post('/api/auth/login').send({ email, password });

    const res = await request(app)
      .post('/api/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${s3.body.accessToken}`)
      .send({ refreshToken: s3.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ revoked: 2 });

    for (const dead of [s1.body.refreshToken, s2.body.refreshToken]) {
      const r = await request(app).post('/api/auth/refresh').send({ refreshToken: dead });
      expect(r.status).toBe(401);
    }
    const alive = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: s3.body.refreshToken });
    expect(alive.status).toBe(200);
  });
});
