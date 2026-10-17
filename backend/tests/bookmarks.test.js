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

const ID = '507f1f77bcf86cd799439011';

describe('auth is required', () => {
  it.each([['post', `/posts/${ID}/bookmark`], ['delete', `/posts/${ID}/bookmark`], ['get', '/bookmarks']])('%s %s -> 401', async (method, path) => {
    expect((await request(app)[method](`${API}${path}`)).status).toBe(401);
  });
});

describe('bookmarks', () => {
  it('adds and removes a bookmark and reflects it in viewer.bookmarked everywhere', async () => {
    const a = await signup(); const p = await makePost(a.agent, 'save me');
    expect((await a.agent.post(`${API}/posts/${p.id}/bookmark`)).body.data).toEqual({ bookmarked: true });
    expect((await a.agent.get(`${API}/posts/feed`)).body.data.posts[0].viewer.bookmarked).toBe(true);
    expect((await a.agent.get(`${API}/posts/${p.id}`)).body.data.post.viewer.bookmarked).toBe(true);
    expect((await a.agent.delete(`${API}/posts/${p.id}/bookmark`)).body.data).toEqual({ bookmarked: false });
    expect((await a.agent.get(`${API}/posts/${p.id}`)).body.data.post.viewer.bookmarked).toBe(false);
    expect(await Bookmark.countDocuments()).toBe(0);
  });

  it('is idempotent (double add = one row, removing a missing bookmark is fine)', async () => {
    const a = await signup(); const p = await makePost(a.agent);
    await a.agent.post(`${API}/posts/${p.id}/bookmark`);
    expect((await a.agent.post(`${API}/posts/${p.id}/bookmark`)).status).toBe(200);
    expect(await Bookmark.countDocuments()).toBe(1);
    await a.agent.delete(`${API}/posts/${p.id}/bookmark`);
    expect((await a.agent.delete(`${API}/posts/${p.id}/bookmark`)).status).toBe(200);
  });

  it('concurrent adds create a single bookmark', async () => {
    const a = await signup(); const p = await makePost(a.agent);
    await Promise.all([1, 2, 3, 4].map(() => a.agent.post(`${API}/posts/${p.id}/bookmark`)));
    expect(await Bookmark.countDocuments()).toBe(1);
  });

  it('404 for a missing post, 400 for a malformed id', async () => {
    const a = await signup();
    expect((await a.agent.post(`${API}/posts/${ID}/bookmark`)).status).toBe(404);
    expect((await a.agent.post(`${API}/posts/nope/bookmark`)).status).toBe(400);
  });

  it('never exposes a bookmark count on posts', async () => {
    const a = await signup(); const p = await makePost(a.agent);
    await a.agent.post(`${API}/posts/${p.id}/bookmark`);
    expect(JSON.stringify((await a.agent.get(`${API}/posts/${p.id}`)).body)).not.toMatch(/bookmarkCount/);
  });
});

describe('GET /bookmarks', () => {
  it('lists my bookmarks newest-bookmarked first (not by post age)', async () => {
    const a = await signup();
    const p1 = await makePost(a.agent, 'older post'); const p2 = await makePost(a.agent, 'newer post');
    await a.agent.post(`${API}/posts/${p2.id}/bookmark`);
    await a.agent.post(`${API}/posts/${p1.id}/bookmark`); // bookmarked last -> first in the list
    const res = await a.agent.get(`${API}/bookmarks`);
    expect(res.status).toBe(200);
    expect(res.body.data.posts.map((p) => p.text)).toEqual(['older post', 'newer post']);
    expect(res.body.data.posts.every((p) => p.viewer.bookmarked)).toBe(true);
    expect(res.body.data.posts[0].author.username).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('email');
  });

  it('paginates with a cursor without duplicates', async () => {
    const a = await signup(); const ids = [];
    for (let i = 1; i <= 5; i++) { const p = await makePost(a.agent, `p${i}`); ids.push(p.id); await a.agent.post(`${API}/posts/${p.id}/bookmark`); }
    const seen = []; let cursor = null; let pages = 0;
    do {
      const res = await a.agent.get(`${API}/bookmarks`).query({ limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...res.body.data.posts.map((p) => p.text)); cursor = res.body.meta.nextCursor; pages += 1;
    } while (cursor);
    expect(seen).toEqual(['p5', 'p4', 'p3', 'p2', 'p1']);
    expect(pages).toBe(3);
  });

  it('is private: other users never see my bookmarks, and my flag is not theirs', async () => {
    const a = await signup(); const b = await signup();
    const p = await makePost(a.agent, 'shared post');
    await a.agent.post(`${API}/posts/${p.id}/bookmark`);
    expect((await b.agent.get(`${API}/bookmarks`)).body.data.posts).toEqual([]);
    expect((await b.agent.get(`${API}/posts/${p.id}`)).body.data.post.viewer.bookmarked).toBe(false);
    expect((await a.agent.get(`${API}/bookmarks`)).body.data.posts).toHaveLength(1);
  });

  it('deleting a post removes it from everyone\'s bookmarks', async () => {
    const a = await signup(); const b = await signup();
    const p = await makePost(a.agent, 'doomed');
    await b.agent.post(`${API}/posts/${p.id}/bookmark`);
    await a.agent.delete(`${API}/posts/${p.id}`);
    expect(await Bookmark.countDocuments()).toBe(0);
    expect((await b.agent.get(`${API}/bookmarks`)).body.data.posts).toEqual([]);
  });

  it('rejects a bad cursor (400)', async () => {
    const a = await signup();
    expect((await a.agent.get(`${API}/bookmarks`).query({ cursor: 'x' })).status).toBe(400);
  });
});
