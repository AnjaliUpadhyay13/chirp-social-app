import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { connectTestDB, disconnectTestDB, clearCollections } from './helpers/db.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Post } = await import('../src/models/Post.js');
const { default: Like } = await import('../src/models/Like.js');
const { default: Repost } = await import('../src/models/Repost.js');
const { default: Follow } = await import('../src/models/Follow.js');
const { default: Bookmark } = await import('../src/models/Bookmark.js');
const { default: Notification } = await import('../src/models/Notification.js');

const API = '/api/v1';
let counter = 0;
async function signup(username = `user_${++counter}`, name) {
  const agent = request.agent(app);
  const res = await agent.post(`${API}/auth/register`)
    .send({ name: name || `Name ${username}`, username, email: `${username}@example.com`, password: 'Passw0rd123' });
  expect(res.status).toBe(201);
  return { agent, user: res.body.data.user, username };
}
const makePost = async (agent, text = 'hello') => (await agent.post(`${API}/posts`).send({ text })).body.data.post;
const makeReply = async (agent, id, text = 'a reply') => (await agent.post(`${API}/posts/${id}/replies`).send({ text })).body.data.post;
const notifs = async (agent, query = {}) => (await agent.get(`${API}/notifications`).query(query)).body;
const unread = async (agent) => (await agent.get(`${API}/notifications/unread-count`)).body.data.unreadCount;

beforeAll(async () => {
  await connectTestDB();
  await Promise.all([User.init(), Post.init(), Like.init(), Repost.init(), Follow.init(), Bookmark.init(), Notification.init()]);
}, 120_000);
afterAll(async () => { await disconnectTestDB(); });
beforeEach(async () => { await clearCollections(); });

const old = (days) => mongoose.Types.ObjectId.createFromTime(Math.floor((Date.now() - days * 86_400_000) / 1000));

describe('auth is required', () => {
  it.each([['/search?q=a'], ['/search/trending'], ['/users/suggestions']])('GET %s -> 401', async (path) => {
    expect((await request(app).get(`${API}${path}`)).status).toBe(401);
  });
});

describe('GET /search validation', () => {
  it.each([['missing q', {}], ['empty q', { q: '   ' }], ['q too long', { q: 'a'.repeat(101) }], ['bad type', { q: 'a', type: 'tweets' }], ['bad limit', { q: 'a', limit: 0 }], ['bad cursor', { q: 'a', cursor: 'x' }]])('%s -> 400', async (_l, query) => {
    const a = await signup();
    expect((await a.agent.get(`${API}/search`).query(query)).status).toBe(400);
  });
});

describe('search people', () => {
  const find = async (agent, q) => (await agent.get(`${API}/search`).query({ q, type: 'users' })).body.data.users.map((u) => u.username);

  it('matches username and display name, case-insensitively, with an optional @', async () => {
    const me = await signup('anjali_u'); await signup('rohan_v', 'Rohan Verma'); await signup('sara_k', 'Sara Khan');
    expect(await find(me.agent, 'ROHAN')).toEqual(['rohan_v']);
    expect(await find(me.agent, 'verma')).toEqual(['rohan_v']);
    expect(await find(me.agent, '@sara_k')).toEqual(['sara_k']);
    expect(await find(me.agent, 'nobody-like-this')).toEqual([]);
  });

  it('ranks exact > prefix > partial, then by followers', async () => {
    const me = await signup('anjali_u');
    await signup('xtom', 'Someone'); const prefix = await signup('tomato', 'Someone'); await signup('tom', 'Someone'); const fan = await signup();
    await fan.agent.post(`${API}/users/tomato/follow`);
    expect(await find(me.agent, 'tom')).toEqual(['tom', 'tomato', 'xtom']);
    expect(prefix.username).toBe('tomato');
  });

  it('returns public data only, with viewer flags', async () => {
    const me = await signup('anjali_u'); await signup('rohan_v');
    await me.agent.post(`${API}/users/rohan_v/follow`);
    const res = await me.agent.get(`${API}/search`).query({ q: 'rohan', type: 'users' });
    expect(res.body.data.users[0]).toMatchObject({ username: 'rohan_v', viewer: { isMe: false, following: true } });
    expect(JSON.stringify(res.body)).not.toMatch(/email|passwordHash/);
  });

  it('treats regex characters literally (no injection, no crash, no match-everything)', async () => {
    const me = await signup('anjali_u'); await signup('rohan_v');
    for (const q of ['.*', '(', '[a-z', '^', '$', '\\', 'a|b', '+++']) {
      const res = await me.agent.get(`${API}/search`).query({ q, type: 'users' });
      expect(res.status).toBe(200);
      expect(res.body.data.users).toEqual([]);
    }
  });
});

describe('search posts', () => {
  const find = async (agent, q, extra = {}) => (await agent.get(`${API}/search`).query({ q, ...extra })).body;

  it('finds posts by text, case-insensitively, including replies, newest first', async () => {
    const a = await signup();
    const p = await makePost(a.agent, 'Learning MERN today');
    await makePost(a.agent, 'something else');
    await makeReply(a.agent, p.id, 'mern is fun');
    const res = await find(a.agent, 'mern');
    expect(res.data.posts.map((x) => x.text)).toEqual(['mern is fun', 'Learning MERN today']);
    expect(res.data.posts[0].viewer).toEqual({ liked: false, reposted: false, bookmarked: false });
    expect(JSON.stringify(res)).not.toContain('email');
  });

  it('#tag searches use the hashtag, not loose text', async () => {
    const a = await signup();
    await makePost(a.agent, 'plain text about mern');
    await makePost(a.agent, 'proper tag #MERN here');
    const tag = await find(a.agent, '#mern');
    expect(tag.data.posts.map((x) => x.text)).toEqual(['proper tag #MERN here']);
    const text = await find(a.agent, 'mern');
    expect(text.data.posts).toHaveLength(2);
  });

  it('paginates with a cursor', async () => {
    const a = await signup();
    for (let i = 1; i <= 5; i++) await makePost(a.agent, `needle ${i}`);
    const seen = []; let cursor = null;
    do {
      const res = await find(a.agent, 'needle', { limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...res.data.posts.map((p) => p.text)); cursor = res.meta.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['needle 5', 'needle 4', 'needle 3', 'needle 2', 'needle 1']);
  });

  it('empty result and regex characters are handled', async () => {
    const a = await signup(); await makePost(a.agent, 'price is 5.00 (approx)');
    expect((await find(a.agent, 'zzzzz')).data.posts).toEqual([]);
    expect((await find(a.agent, '5.00 (approx)')).data.posts).toHaveLength(1);
    expect((await find(a.agent, '.*')).data.posts).toEqual([]);
    expect((await a.agent.get(`${API}/search`).query({ q: '(' })).status).toBe(200);
  });
});

describe('GET /search/trending', () => {
  const trends = async (agent, query = {}) => (await agent.get(`${API}/search/trending`).query(query)).body.data.trends;

  it('ranks tags by distinct authors, then by post count', async () => {
    const a = await signup(); const b = await signup(); const c = await signup();
    await makePost(a.agent, 'one #alpha'); await makePost(b.agent, 'two #alpha'); await makePost(c.agent, 'three #alpha');
    await makePost(a.agent, 'spam #beta'); await makePost(a.agent, 'spam #beta'); await makePost(a.agent, 'spam #beta'); await makePost(a.agent, 'spam #beta');
    await makePost(b.agent, 'x #gamma'); await makePost(a.agent, 'y #gamma');
    expect(await trends(a.agent)).toEqual([
      { tag: 'alpha', posts: 3, authors: 3 },
      { tag: 'gamma', posts: 2, authors: 2 },
      { tag: 'beta', posts: 4, authors: 1 },
    ]);
  });

  it('normalises case, counts replies, and counts a tag once per post', async () => {
    const a = await signup(); const p = await makePost(a.agent, '#Node and #node again');
    await makeReply(a.agent, p.id, 'reply with #NODE');
    expect(await trends(a.agent)).toEqual([{ tag: 'node', posts: 2, authors: 1 }]);
  });

  it('ignores posts older than 7 days and respects the limit', async () => {
    const a = await signup();
    await Post.create({ _id: old(10), author: a.user.id, text: 'ancient #oldtag', hashtags: ['oldtag'] });
    for (const t of ['t1', 't2', 't3']) await makePost(a.agent, `post #${t}`);
    const all = await trends(a.agent);
    expect(all.map((x) => x.tag)).not.toContain('oldtag');
    expect(await trends(a.agent, { limit: 2 })).toHaveLength(2);
  });

  it('is empty when nobody used a hashtag, and validates limit', async () => {
    const a = await signup(); await makePost(a.agent, 'no tags here');
    expect(await trends(a.agent)).toEqual([]);
    expect((await a.agent.get(`${API}/search/trending`).query({ limit: 99 })).status).toBe(400);
  });
});

describe('GET /users/suggestions', () => {
  const names = async (agent, query = {}) => (await agent.get(`${API}/users/suggestions`).query(query)).body.data.users.map((u) => u.username);

  it('excludes you and people you follow, most-followed first', async () => {
    const me = await signup('anjali_u');
    const pop = await signup('popular'); await signup('quiet'); const mid = await signup('middle'); const f1 = await signup(); const f2 = await signup();
    await f1.agent.post(`${API}/users/popular/follow`); await f2.agent.post(`${API}/users/popular/follow`); await f1.agent.post(`${API}/users/middle/follow`);
    await me.agent.post(`${API}/users/middle/follow`);
    const got = await names(me.agent);
    expect(got).not.toContain('anjali_u');
    expect(got).not.toContain('middle');
    expect(got[0]).toBe('popular');
    expect(pop.username).toBe('popular'); expect(mid.username).toBe('middle');
  });

  it('respects the limit, returns public data only, and a followed user disappears', async () => {
    const me = await signup('anjali_u'); for (let i = 0; i < 4; i++) await signup();
    expect(await names(me.agent, { limit: 2 })).toHaveLength(2);
    const res = await me.agent.get(`${API}/users/suggestions`);
    expect(JSON.stringify(res.body)).not.toMatch(/email|passwordHash/);
    expect(res.body.data.users[0].viewer).toEqual({ isMe: false, following: false });
    const first = res.body.data.users[0].username;
    await me.agent.post(`${API}/users/${first}/follow`);
    expect(await names(me.agent)).not.toContain(first);
  });

  it('is empty when there is nobody else', async () => {
    const me = await signup();
    expect(await names(me.agent)).toEqual([]);
  });

  it('"suggestions" cannot be registered as a username (route clash)', async () => {
    const res = await request(app).post(`${API}/auth/register`).send({ name: 'X', username: 'suggestions', email: 's@example.com', password: 'Passw0rd123' });
    expect(res.status).toBe(400);
  });
});
