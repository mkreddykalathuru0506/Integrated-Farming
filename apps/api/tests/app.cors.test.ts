import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

/**
 * CORS allowlist (security finding #2). No DB needed — exercises only the CORS layer
 * against the public /api/health endpoint, so this runs in every environment.
 * `corsOptions()` reads process.env.WEB_ORIGIN at createApp()-time, so each case builds
 * a fresh app under the env it wants.
 */
describe('CORS allowlist', () => {
  const ALLOWED = 'https://farm.example.com';

  afterEach(() => {
    delete process.env.WEB_ORIGIN;
  });

  it('permits any origin when WEB_ORIGIN is unset (dev default)', async () => {
    delete process.env.WEB_ORIGIN;
    const app = createApp();
    const res = await request(app).get('/api/health').set('Origin', 'https://anything.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('reflects an allowlisted origin when WEB_ORIGIN is set', async () => {
    process.env.WEB_ORIGIN = ALLOWED;
    const app = createApp();
    const res = await request(app).get('/api/health').set('Origin', ALLOWED);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('withholds the ACAO header for a disallowed origin (browser blocks it)', async () => {
    process.env.WEB_ORIGIN = ALLOWED;
    const app = createApp();
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    // Request still completes (no 500), but no Allow-Origin header is granted.
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('supports a comma-separated allowlist of multiple origins', async () => {
    const second = 'https://admin.example.com';
    process.env.WEB_ORIGIN = `${ALLOWED}, ${second}`;
    const app = createApp();
    const res = await request(app).get('/api/health').set('Origin', second);
    expect(res.headers['access-control-allow-origin']).toBe(second);
  });
});
