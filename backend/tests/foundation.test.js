import { describe, it, expect } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');

describe('Phase 1 foundation', () => {
  it('GET /api/v1/health returns the standard envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /api/v1/config exposes the post character limit', async () => {
    const res = await request(app).get('/api/v1/config');
    expect(res.body.data.postMaxLength).toBe(280);
  });

  it('unknown routes return a 404 JSON error', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('malformed JSON returns a 400 JSON error', async () => {
    const res = await request(app).post('/api/v1/health').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers (helmet) and hides x-powered-by', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('blocks disallowed CORS origins', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_BLOCKED');
  });
});
