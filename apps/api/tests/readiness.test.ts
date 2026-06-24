import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const suite = process.env.DATABASE_URL ? describe : describe.skip;

describe('liveness', () => {
  it('GET /api/health is ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

suite('readiness', () => {
  it('GET /api/health/ready reports db ready when the DB is reachable', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.db).toBe(true);
  });
});
