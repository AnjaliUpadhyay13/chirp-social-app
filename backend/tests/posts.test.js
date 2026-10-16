import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from './helpers/db.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Post } = await import('../src/models/Post.js');
const { default: Like } = await import('../src/models/Like.js');
const { default: Repost } = await import('../src/models/Repost.js');
const { default: env } = await import('../src/config/env.js');
const { extractHashtags } = await import('../src/utils/hashtags.js');

const API = '/api/v1';
let counter = 0;

// Registers a fresh user and returns a cookie-carrying agent
async function signup(username = `user_${++counter}`) {
  const agent = request.agent(app);
  const res = await agent.post(`${API}/auth/register`)
    .send({ name: `Name ${username}`, username, email: `${username}@example.com`, password: 'Passw0rd123' });
  expect(res.status).toBe(201);
  return { agent, user: res.body.data.user };
}
const makePost = async (agent, text = 'hello world') => (await agent.post(`${API}/posts`).send({ text })).body.data.post;
const makeReply = async (agent, id, text = 'a reply') => (await agent.post(`${API}/posts/${id}/replies`).send({ text })).body.data.post;

beforeAll(async () => {
  await connectTestDB();
  await Promise.all([User.init(), Post.init(), Like.init(), Repost.init()]);
}, 120_000);
afterAll(async () => { await disconnectTestDB(); });
beforeEach(async () => { await clearCollections(); });

describe('hashtag extraction', () => {
  it('extracts unique, lowercased tags and ignores glued/ampersand ones', () => {
    expect(extractHashtags('Hello #React and #react, plus #Node_js! a#nope &#amp #हिंदी')).toEqual(['react', 'node_js', 'हिंदी']);
  });
});

describe('auth is required on every post endpoint', () => {
  it.each([
    ['post', '/posts'], ['get', '/posts/feed'], ['get', '/posts/507f1f77bcf86cd799439011'],
    ['delete', '/posts/507f1f77bcf86cd799439011'], ['get', '/posts/507f1f77bcf86cd799439011/replies'],
    ['post', '/posts/507f1f77bcf86cd799439011/replies'], ['post', '/posts/507f1f77bcf86cd799439011/like'],
    ['delete', '/posts/507f1f77bcf86cd799439011/like'], ['post', '/posts/507f1f77bcf86cd799439011/repost'],
    ['delete', '/posts/507f1f77bcf86cd799439011/repost'],
  ])('%s %s -> 401 without a session', async (method, path) => {
    const res = await request(app)[method](`${API}${path}`).send({ text: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('POST /posts', () => {
  it('creates a post with author info, zero counts and viewer flags, without leaking private fields', async () => {
    const { agent, user } = await signup('anjali_u');
    const res = await agent.post(`${API}/posts`).send({ text: '  Hello #World  ' });
    expect(res.status).toBe(201);
    const p = res.body.data.post;
    expect(p).toMatchObject({
      text: 'Hello #World', hashtags: ['world'], likeCount: 0, replyCount: 0, repostCount: 0,
      replyTo: null, viewer: { liked: false, reposted: false },
    });
    expect(p.author).toEqual({ id: user.id, name: 'Name anjali_u', username: 'anjali_u', avatar: '' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('email');
    expect(raw).not.toContain('passwordHash');
    expect(await Post.countDocuments()).toBe(1);
  });

  it.each([
    ['empty text', { text: '' }],
    ['whitespace only', { text: '   \n  ' }],
    ['missing text', {}],
    ['non-string text', { text: { $ne: null } }],
    ['unknown fields (mass assignment)', { text: 'hi', likeCount: 999, author: '507f1f77bcf86cd799439011' }],
  ])('rejects %s (400)', async (_l, body) => {
    const { agent } = await signup();
    const res = await agent.post(`${API}/posts`).send(body);
    expect(res.status).toBe(400);
    expect(await Post.countDocuments()).toBe(0);
  });

  it('enforces the configurable character limit (counts emoji as one character)', async () => {
    const { agent } = await signup();
    const max = env.POST_MAX_LENGTH;
    expect((await agent.post(`${API}/posts`).send({ text: 'a'.repeat(max) })).status).toBe(201);
    const over = await agent.post(`${API}/posts`).send({ text: 'a'.repeat(max + 1) });
    expect(over.status).toBe(400);
    expect(over.body.error.details[0].message).toMatch(new RegExp(`${max} characters`));
    expect((await agent.post(`${API}/posts`).send({ text: '😀'.repeat(max) })).status).toBe(201);
  });

  it('stores markup as plain text (React escapes it on render)', async () => {
    const { agent } = await signup();
    const p = await makePost(agent, '<script>alert(1)</script>');
    expect(p.text).toBe('<script>alert(1)</script>');
  });
});

describe('GET /posts/feed', () => {
  it('returns top-level posts newest first, excluding replies, with author info', async () => {
    const { agent } = await signup();
    const a = await makePost(agent, 'first');
    const b = await makePost(agent, 'second');
    await makeReply(agent, a.id, 'a reply');
    const res = await agent.get(`${API}/posts/feed`);
    expect(res.status).toBe(200);
    expect(res.body.data.posts.map((p) => p.text)).toEqual(['second', 'first']);
    expect(res.body.data.posts[0].id).toBe(b.id);
    expect(res.body.meta.nextCursor).toBeNull();
  });

  it('shows other users\' posts too (global timeline until follows exist)', async () => {
    const u1 = await signup(); const u2 = await signup();
    await makePost(u1.agent, 'from u1');
    const res = await u2.agent.get(`${API}/posts/feed`);
    expect(res.body.data.posts.map((p) => p.text)).toEqual(['from u1']);
  });

  it('paginates with a cursor: no duplicates, no gaps, ends with null', async () => {
    const { agent } = await signup();
    for (let i = 1; i <= 5; i++) await makePost(agent, `post ${i}`);
    const seen = [];
    let cursor = null; let pages = 0;
    do {
      const res = await agent.get(`${API}/posts/feed`).query({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      seen.push(...res.body.data.posts.map((p) => p.text));
      cursor = res.body.meta.nextCursor; pages += 1;
    } while (cursor);
    expect(seen).toEqual(['post 5', 'post 4', 'post 3', 'post 2', 'post 1']);
    expect(pages).toBe(3);
  });

  it('new posts do not shift older pages (cursor stability)', async () => {
    const { agent } = await signup();
    for (let i = 1; i <= 4; i++) await makePost(agent, `p${i}`);
    const first = await agent.get(`${API}/posts/feed`).query({ limit: 2 });
    await makePost(agent, 'brand new');
    const second = await agent.get(`${API}/posts/feed`).query({ limit: 2, cursor: first.body.meta.nextCursor });
    expect(second.body.data.posts.map((p) => p.text)).toEqual(['p2', 'p1']);
  });

  it.each([['bad cursor', { cursor: 'nope' }], ['limit 0', { limit: 0 }], ['limit too big', { limit: 500 }]])
  ('rejects %s (400)', async (_l, query) => {
    const { agent } = await signup();
    expect((await agent.get(`${API}/posts/feed`).query(query)).status).toBe(400);
  });

  it('flags what the current viewer has liked / reposted', async () => {
    const u1 = await signup(); const u2 = await signup();
    const p = await makePost(u1.agent, 'likeable');
    await u2.agent.post(`${API}/posts/${p.id}/like`);
    await u2.agent.post(`${API}/posts/${p.id}/repost`);
    const mine = await u2.agent.get(`${API}/posts/feed`);
    expect(mine.body.data.posts[0]).toMatchObject({ likeCount: 1, repostCount: 1, viewer: { liked: true, reposted: true } });
    const theirs = await u1.agent.get(`${API}/posts/feed`);
    expect(theirs.body.data.posts[0].viewer).toEqual({ liked: false, reposted: false });
  });
});

describe('GET /posts/:id', () => {
  it('returns a post with no ancestors for top-level posts', async () => {
    const { agent } = await signup();
    const p = await makePost(agent);
    const res = await agent.get(`${API}/posts/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.post.id).toBe(p.id);
    expect(res.body.data.ancestors).toEqual([]);
  });

  it('returns the full ancestor chain, root first, for a deep reply', async () => {
    const { agent } = await signup();
    const root = await makePost(agent, 'root');
    const r1 = await makeReply(agent, root.id, 'r1');
    const r2 = await makeReply(agent, r1.id, 'r2');
    const r3 = await makeReply(agent, r2.id, 'r3');
    const res = await agent.get(`${API}/posts/${r3.id}`);
    expect(res.body.data.ancestors.map((a) => a.text)).toEqual(['root', 'r1', 'r2']);
    expect(res.body.data.post.rootPost).toBe(root.id);
    expect(res.body.data.post.replyTo).toBe(r2.id);
  });

  it('404 for unknown id, 400 for malformed id', async () => {
    const { agent } = await signup();
    expect((await agent.get(`${API}/posts/507f1f77bcf86cd799439011`)).status).toBe(404);
    expect((await agent.get(`${API}/posts/not-an-id`)).status).toBe(400);
  });
});

describe('replies', () => {
  it('creates a reply, links it to the parent and increments replyCount', async () => {
    const u1 = await signup(); const u2 = await signup();
    const parent = await makePost(u1.agent, 'parent');
    const res = await u2.agent.post(`${API}/posts/${parent.id}/replies`).send({ text: 'nice #one' });
    expect(res.status).toBe(201);
    expect(res.body.data.post).toMatchObject({ replyTo: parent.id, rootPost: parent.id, text: 'nice #one', hashtags: ['one'] });
    const after = await u1.agent.get(`${API}/posts/${parent.id}`);
    expect(after.body.data.post.replyCount).toBe(1);
  });

  it('lists direct replies oldest-first with pagination', async () => {
    const { agent } = await signup();
    const parent = await makePost(agent, 'parent');
    for (let i = 1; i <= 3; i++) await makeReply(agent, parent.id, `reply ${i}`);
    const p1 = await agent.get(`${API}/posts/${parent.id}/replies`).query({ limit: 2 });
    expect(p1.body.data.posts.map((p) => p.text)).toEqual(['reply 1', 'reply 2']);
    const p2 = await agent.get(`${API}/posts/${parent.id}/replies`).query({ limit: 2, cursor: p1.body.meta.nextCursor });
    expect(p2.body.data.posts.map((p) => p.text)).toEqual(['reply 3']);
    expect(p2.body.meta.nextCursor).toBeNull();
  });

  it('only lists direct children, not grandchildren', async () => {
    const { agent } = await signup();
    const root = await makePost(agent, 'root');
    const child = await makeReply(agent, root.id, 'child');
    await makeReply(agent, child.id, 'grandchild');
    const res = await agent.get(`${API}/posts/${root.id}/replies`);
    expect(res.body.data.posts.map((p) => p.text)).toEqual(['child']);
  });

  it('404 when replying to / listing replies of a missing post; validates text', async () => {
    const { agent } = await signup();
    expect((await agent.post(`${API}/posts/507f1f77bcf86cd799439011/replies`).send({ text: 'x' })).status).toBe(404);
    expect((await agent.get(`${API}/posts/507f1f77bcf86cd799439011/replies`)).status).toBe(404);
    const p = await makePost(agent);
    expect((await agent.post(`${API}/posts/${p.id}/replies`).send({ text: '  ' })).status).toBe(400);
  });
});

describe('likes', () => {
  it('like and unlike update the persisted count', async () => {
    const u1 = await signup(); const u2 = await signup();
    const p = await makePost(u1.agent);
    const liked = await u2.agent.post(`${API}/posts/${p.id}/like`);
    expect(liked.status).toBe(200);
    expect(liked.body.data).toEqual({ liked: true, likeCount: 1 });
    expect((await Post.findById(p.id)).likeCount).toBe(1);
    const unliked = await u2.agent.delete(`${API}/posts/${p.id}/like`);
    expect(unliked.body.data).toEqual({ liked: false, likeCount: 0 });
    expect(await Like.countDocuments()).toBe(0);
  });

  it('liking twice does not double count (idempotent)', async () => {
    const { agent } = await signup();
    const p = await makePost(agent);
    await agent.post(`${API}/posts/${p.id}/like`);
    const again = await agent.post(`${API}/posts/${p.id}/like`);
    expect(again.status).toBe(200);
    expect(again.body.data.likeCount).toBe(1);
    expect(await Like.countDocuments()).toBe(1);
  });

  it('concurrent likes from the same user count once', async () => {
    const { agent } = await signup();
    const p = await makePost(agent);
    await Promise.all([1, 2, 3, 4].map(() => agent.post(`${API}/posts/${p.id}/like`)));
    expect(await Like.countDocuments({ post: p.id })).toBe(1);
    expect((await Post.findById(p.id)).likeCount).toBe(1);
  });

  it('different users each add one like', async () => {
    const [a, b, c] = [await signup(), await signup(), await signup()];
    const p = await makePost(a.agent);
    for (const u of [a, b, c]) await u.agent.post(`${API}/posts/${p.id}/like`);
    expect((await Post.findById(p.id)).likeCount).toBe(3);
    expect(await Like.countDocuments({ post: p.id })).toBe(3);
  });

  it('unliking something never liked does not make the count negative', async () => {
    const { agent } = await signup();
    const p = await makePost(agent);
    const res = await agent.delete(`${API}/posts/${p.id}/like`);
    expect(res.status).toBe(200);
    expect(res.body.data.likeCount).toBe(0);
  });

  it('404 on a missing post, 400 on a malformed id', async () => {
    const { agent } = await signup();
    expect((await agent.post(`${API}/posts/507f1f77bcf86cd799439011/like`)).status).toBe(404);
    expect((await agent.post(`${API}/posts/xyz/like`)).status).toBe(400);
  });
});

describe('reposts', () => {
  it('repost / undo repost with idempotency and persisted counts', async () => {
    const u1 = await signup(); const u2 = await signup();
    const p = await makePost(u1.agent);
    expect((await u2.agent.post(`${API}/posts/${p.id}/repost`)).body.data).toEqual({ reposted: true, repostCount: 1 });
    expect((await u2.agent.post(`${API}/posts/${p.id}/repost`)).body.data.repostCount).toBe(1);
    expect(await Repost.countDocuments()).toBe(1);
    expect((await u2.agent.delete(`${API}/posts/${p.id}/repost`)).body.data).toEqual({ reposted: false, repostCount: 0 });
    expect((await u2.agent.delete(`${API}/posts/${p.id}/repost`)).body.data.repostCount).toBe(0);
  });

  it('concurrent reposts count once', async () => {
    const { agent } = await signup();
    const p = await makePost(agent);
    await Promise.all([1, 2, 3].map(() => agent.post(`${API}/posts/${p.id}/repost`)));
    expect((await Post.findById(p.id)).repostCount).toBe(1);
  });
});

describe('DELETE /posts/:id (ownership)', () => {
  it('lets the owner delete their post', async () => {
    const { agent } = await signup();
    const p = await makePost(agent);
    const res = await agent.delete(`${API}/posts/${p.id}`);
    expect(res.status).toBe(200);
    expect(await Post.countDocuments()).toBe(0);
    expect((await agent.get(`${API}/posts/${p.id}`)).status).toBe(404);
  });

  it('forbids deleting someone else\'s post (403) and leaves it intact', async () => {
    const owner = await signup(); const other = await signup();
    const p = await makePost(owner.agent);
    const res = await other.agent.delete(`${API}/posts/${p.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await Post.countDocuments()).toBe(1);
  });

  it('404 for a missing post', async () => {
    const { agent } = await signup();
    expect((await agent.delete(`${API}/posts/507f1f77bcf86cd799439011`)).status).toBe(404);
  });

  it('cascades: removes the whole reply subtree plus its likes and reposts', async () => {
    const u1 = await signup(); const u2 = await signup();
    const root = await makePost(u1.agent, 'root');
    const child = await makeReply(u2.agent, root.id, 'child');
    await makeReply(u1.agent, child.id, 'grandchild');
    const keep = await makePost(u1.agent, 'unrelated');
    await u2.agent.post(`${API}/posts/${root.id}/like`);
    await u2.agent.post(`${API}/posts/${child.id}/repost`);
    await u1.agent.post(`${API}/posts/${keep.id}/like`);

    const res = await u1.agent.delete(`${API}/posts/${root.id}`);
    expect(res.body.data.removed).toBe(3);
    expect(await Post.countDocuments()).toBe(1);
    expect(await Like.countDocuments()).toBe(1); // only the like on 'unrelated' survives
    expect(await Repost.countDocuments()).toBe(0);
  });

  it('deleting a reply decrements the parent\'s replyCount', async () => {
    const { agent } = await signup();
    const parent = await makePost(agent);
    const r1 = await makeReply(agent, parent.id, 'r1');
    await makeReply(agent, parent.id, 'r2');
    expect((await Post.findById(parent.id)).replyCount).toBe(2);
    await agent.delete(`${API}/posts/${r1.id}`);
    expect((await Post.findById(parent.id)).replyCount).toBe(1);
  });
});
