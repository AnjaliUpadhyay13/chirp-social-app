import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { connectTestDB, disconnectTestDB, clearCollections } from './helpers/db.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: env } = await import('../src/config/env.js');

const valid = { name: 'Anjali Upadhyay', username: 'anjali_u', email: 'anjali@example.com', password: 'Passw0rd123' };
const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${env.COOKIE_NAME}=`));

beforeAll(async () => { await connectTestDB(); await User.init(); }, 120_000);
afterAll(async () => { await disconnectTestDB(); });
beforeEach(async () => { await clearCollections(); });

describe('POST /auth/register', () => {
  it('creates a user, sets an httpOnly cookie and never leaks the password hash', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ name: valid.name, username: 'anjali_u', email: valid.email });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('argon2');
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('stores an Argon2id hash, not the plaintext password', async () => {
    await request(app).post('/api/v1/auth/register').send(valid);
    const doc = await User.findOne({ email: valid.email }).select('+passwordHash');
    expect(doc.passwordHash).toMatch(/^\$argon2id\$/);
    expect(doc.passwordHash).not.toContain(valid.password);
  });

  it('normalises email and username to lowercase', async () => {
    const res = await request(app).post('/api/v1/auth/register')
      .send({ ...valid, email: 'ANJALI@Example.com', username: 'Anjali_U' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('anjali@example.com');
    expect(res.body.data.user.username).toBe('anjali_u');
  });

  it('rejects duplicate email and duplicate username with field details (409)', async () => {
    await request(app).post('/api/v1/auth/register').send(valid);
    const res = await request(app).post('/api/v1/auth/register').send(valid);
    expect(res.status).toBe(409);
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual(['email', 'username']);
  });

  it('treats email case-insensitively for duplicates', async () => {
    await request(app).post('/api/v1/auth/register').send(valid);
    const res = await request(app).post('/api/v1/auth/register')
      .send({ ...valid, username: 'other_user', email: 'ANJALI@EXAMPLE.COM' });
    expect(res.status).toBe(409);
  });

  it.each([
    ['short password', { password: 'Ab1' }, 'password'],
    ['password without number', { password: 'onlyletters' }, 'password'],
    ['password without letter', { password: '12345678' }, 'password'],
    ['bad email', { email: 'not-an-email' }, 'email'],
    ['bad username chars', { username: 'bad name!' }, 'username'],
    ['too-short username', { username: 'ab' }, 'username'],
    ['reserved username', { username: 'admin' }, 'username'],
    ['empty name', { name: '   ' }, 'name'],
  ])('rejects %s (400)', async (_label, patch, field) => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d) => d.field === field)).toBe(true);
  });

  it('rejects unknown fields (mass-assignment guard)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...valid, followerCount: 9999, isAdmin: true });
    expect(res.status).toBe(400);
  });

  it('rejects missing body fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(4);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => { await request(app).post('/api/v1/auth/register').send(valid); });

  it('logs in with email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: valid.email, password: valid.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('anjali_u');
    expect(cookieOf(res)).toBeTruthy();
  });

  it('logs in with username (case-insensitive)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: 'ANJALI_U', password: valid.password });
    expect(res.status).toBe(200);
  });

  it('wrong password and unknown user return the same 401 message', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ identifier: valid.email, password: 'Wrong1234' });
    const unknown = await request(app).post('/api/v1/auth/login').send({ identifier: 'nobody@example.com', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(cookieOf(wrong)).toBeUndefined();
  });

  it('is not vulnerable to NoSQL operator injection', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(cookieOf(res)).toBeUndefined();
  });

  it('rejects missing credentials (400)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /auth/me + logout (protected routes)', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the current user with a valid session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(valid);
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(valid.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('logout clears the cookie and the session stops working', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send(valid);
    const out = await agent.post('/api/v1/auth/logout');
    expect(out.status).toBe(200);
    expect(cookieOf(out)).toMatch(/Expires=Thu, 01 Jan 1970/i);
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(valid);
    const token = cookieOf(reg).split(';')[0].split('=')[1];
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `${env.COOKIE_NAME}=${token}x`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const user = await User.create({ name: 'X', username: 'xuser', email: 'x@example.com', passwordHash: 'h' });
    const forged = jwt.sign({}, 'some-other-secret-some-other-secret-123', { subject: user.id, expiresIn: '1h' });
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `${env.COOKIE_NAME}=${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const user = await User.create({ name: 'X', username: 'xuser', email: 'x@example.com', passwordHash: 'h' });
    const expired = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: -10 });
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `${env.COOKIE_NAME}=${expired}`);
    expect(res.status).toBe(401);
  });

  it('a valid token for a deleted user is rejected', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/v1/auth/register').send(valid);
    await User.deleteOne({ _id: reg.body.data.user.id });
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Database-level guarantees', () => {
  it('unique indexes block duplicates even if the service pre-check is bypassed', async () => {
    await User.create({ name: 'A', username: 'dupuser', email: 'dup@example.com', passwordHash: 'h' });
    await expect(User.create({ name: 'B', username: 'dupuser', email: 'other@example.com', passwordHash: 'h' }))
      .rejects.toMatchObject({ code: 11000 });
  });

  it('concurrent registrations with the same email create only one account', async () => {
    const attempts = await Promise.all(
      [1, 2, 3].map((i) => request(app).post('/api/v1/auth/register').send({ ...valid, username: `racer_${i}` })),
    );
    const statuses = attempts.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(await User.countDocuments({ email: valid.email })).toBe(1);
  });
});
