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
  it.each([['get', '/notifications'], ['get', '/notifications/unread-count'], ['patch', '/notifications/read-all'], ['patch', `/notifications/${ID}/read`]])('%s %s -> 401', async (method, path) => {
    expect((await request(app)[method](`${API}${path}`)).status).toBe(401);
  });
});

describe('notification generation', () => {
  it('a like notifies the post author (with actor and post snippet), not the liker', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const p = await makePost(a.agent, 'my great post');
    await b.agent.post(`${API}/posts/${p.id}/like`);
    const res = await notifs(a.agent);
    expect(res.data.notifications).toHaveLength(1);
    expect(res.data.notifications[0]).toMatchObject({ type: 'like', readAt: null, actor: { username: 'rohan_v' }, post: { id: p.id, text: 'my great post' } });
    expect(JSON.stringify(res)).not.toContain('email');
    expect((await notifs(b.agent)).data.notifications).toEqual([]);
    expect(await unread(a.agent)).toBe(1);
  });

  it('never notifies you about your own actions', async () => {
    const a = await signup();
    const p = await makePost(a.agent);
    await a.agent.post(`${API}/posts/${p.id}/like`);
    await a.agent.post(`${API}/posts/${p.id}/repost`);
    await makeReply(a.agent, p.id, 'self reply');
    expect(await Notification.countDocuments()).toBe(0);
  });

  it('liking twice (idempotent) gives one notification; unlike withdraws it; re-like gives exactly one fresh unread one', async () => {
    const a = await signup(); const b = await signup();
    const p = await makePost(a.agent);
    await b.agent.post(`${API}/posts/${p.id}/like`);
    await b.agent.post(`${API}/posts/${p.id}/like`);
    expect(await Notification.countDocuments()).toBe(1);
    await b.agent.delete(`${API}/posts/${p.id}/like`);
    expect(await Notification.countDocuments()).toBe(0);
    await b.agent.post(`${API}/posts/${p.id}/like`);
    expect(await Notification.countDocuments()).toBe(1);
    expect(await unread(a.agent)).toBe(1);
  });

  it('reposts notify the author and are withdrawn on undo', async () => {
    const a = await signup(); const b = await signup();
    const p = await makePost(a.agent);
    await b.agent.post(`${API}/posts/${p.id}/repost`);
    expect((await notifs(a.agent)).data.notifications[0].type).toBe('repost');
    await b.agent.delete(`${API}/posts/${p.id}/repost`);
    expect((await notifs(a.agent)).data.notifications).toEqual([]);
  });

  it('a reply notifies the author of the post being replied to, showing the reply text', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const p = await makePost(a.agent, 'parent');
    const r = await makeReply(b.agent, p.id, 'nice parent!');
    const n = (await notifs(a.agent)).data.notifications[0];
    expect(n).toMatchObject({ type: 'reply', actor: { username: 'rohan_v' }, post: { id: r.id, text: 'nice parent!' } });
  });

  it('a follow notifies the person followed and has no post; unfollow withdraws it', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    await b.agent.post(`${API}/users/anjali_u/follow`);
    await b.agent.post(`${API}/users/anjali_u/follow`); // idempotent
    const list = (await notifs(a.agent)).data.notifications;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'follow', post: null, actor: { username: 'rohan_v' } });
    await b.agent.delete(`${API}/users/anjali_u/follow`);
    expect(await Notification.countDocuments()).toBe(0);
    await b.agent.post(`${API}/users/anjali_u/follow`);
    expect(await Notification.countDocuments()).toBe(1);
  });

  it('unfollowing one person only withdraws THAT notification, not other people\'s', async () => {
    const actor = await signup('actor_one'); const x = await signup('target_x'); const y = await signup('target_y');
    await actor.agent.post(`${API}/users/target_x/follow`);
    await actor.agent.post(`${API}/users/target_y/follow`);
    await actor.agent.delete(`${API}/users/target_x/follow`);
    expect(await unread(x.agent)).toBe(0);
    expect(await unread(y.agent)).toBe(1);
  });

  it('deleting a post removes the notifications that point at it (likes, replies)', async () => {
    const a = await signup(); const b = await signup();
    const p = await makePost(a.agent, 'to be deleted');
    await b.agent.post(`${API}/posts/${p.id}/like`);
    const r = await makeReply(b.agent, p.id, 'reply');
    await b.agent.post(`${API}/users/${a.username}/follow`);
    await a.agent.delete(`${API}/posts/${p.id}`);
    const left = await Notification.find().lean();
    expect(left.map((n) => n.type)).toEqual(['follow']);
    expect(await Notification.countDocuments({ post: r.id })).toBe(0);
  });
});

describe('listing, unread count and marking read', () => {
  it('lists newest first with cursor pagination and truncates long snippets', async () => {
    const a = await signup('anjali_u');
    const long = 'x'.repeat(200); // over the 140-char snippet, under the 280 post limit
    const p = await makePost(a.agent, long);
    for (let i = 1; i <= 4; i++) { const f = await signup(); await f.agent.post(`${API}/posts/${p.id}/like`); }
    const seen = []; let cursor = null; let pages = 0;
    do {
      const res = await notifs(a.agent, { limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...res.data.notifications); cursor = res.meta.nextCursor; pages += 1;
    } while (cursor);
    expect(seen).toHaveLength(4);
    expect(new Set(seen.map((n) => n.id)).size).toBe(4);
    expect(pages).toBe(2);
    expect(seen[0].post.text.length).toBe(141); // 140 chars + ellipsis
    const ids = seen.map((n) => n.id); expect(ids).toEqual([...ids].sort().reverse());
  });

  it('mark read lowers the unread count; marking again is harmless', async () => {
    const a = await signup(); const b = await signup(); const c = await signup();
    const p = await makePost(a.agent);
    await b.agent.post(`${API}/posts/${p.id}/like`); await c.agent.post(`${API}/posts/${p.id}/like`);
    expect(await unread(a.agent)).toBe(2);
    const [first] = (await notifs(a.agent)).data.notifications;
    const res = await a.agent.patch(`${API}/notifications/${first.id}/read`);
    expect(res.body.data).toEqual({ read: true, unreadCount: 1 });
    expect((await a.agent.patch(`${API}/notifications/${first.id}/read`)).body.data.unreadCount).toBe(1);
    const after = (await notifs(a.agent)).data.notifications.find((n) => n.id === first.id);
    expect(after.readAt).not.toBeNull();
  });

  it('read-all marks everything read', async () => {
    const a = await signup(); const p = await makePost(a.agent);
    for (let i = 0; i < 3; i++) { const f = await signup(); await f.agent.post(`${API}/posts/${p.id}/like`); }
    const res = await a.agent.patch(`${API}/notifications/read-all`);
    expect(res.body.data).toEqual({ updated: 3, unreadCount: 0 });
    expect(await unread(a.agent)).toBe(0);
    expect((await a.agent.patch(`${API}/notifications/read-all`)).body.data.updated).toBe(0);
  });

  it('users can only see and change their OWN notifications', async () => {
    const a = await signup(); const b = await signup(); const c = await signup();
    const p = await makePost(a.agent);
    await b.agent.post(`${API}/posts/${p.id}/like`);
    const [mine] = (await notifs(a.agent)).data.notifications;
    // c cannot read it, mark it read, or see it in a list
    expect((await notifs(c.agent)).data.notifications).toEqual([]);
    const steal = await c.agent.patch(`${API}/notifications/${mine.id}/read`);
    expect(steal.status).toBe(404);
    expect((await Notification.findById(mine.id)).readAt).toBeNull();
    // c's read-all must not touch a's notifications
    await c.agent.patch(`${API}/notifications/read-all`);
    expect(await unread(a.agent)).toBe(1);
  });

  it('404 for a missing id and 400 for a malformed id', async () => {
    const a = await signup();
    expect((await a.agent.patch(`${API}/notifications/${ID}/read`)).status).toBe(404);
    expect((await a.agent.patch(`${API}/notifications/xyz/read`)).status).toBe(400);
  });
});
