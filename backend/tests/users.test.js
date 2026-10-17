import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearCollections } from './helpers/db.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Post } = await import('../src/models/Post.js');
const { default: Like } = await import('../src/models/Like.js');
const { default: Repost } = await import('../src/models/Repost.js');
const { default: Follow } = await import('../src/models/Follow.js');

const API = '/api/v1';
let counter = 0;

async function signup(username = `user_${++counter}`) {
  const agent = request.agent(app);
  const res = await agent.post(`${API}/auth/register`)
    .send({ name: `Name ${username}`, username, email: `${username}@example.com`, password: 'Passw0rd123' });
  expect(res.status).toBe(201);
  return { agent, user: res.body.data.user, username };
}
const makePost = async (agent, text = 'hello') => (await agent.post(`${API}/posts`).send({ text })).body.data.post;
const makeReply = async (agent, id, text = 'a reply') => (await agent.post(`${API}/posts/${id}/replies`).send({ text })).body.data.post;
const profileOf = async (agent, username) => (await agent.get(`${API}/users/${username}`)).body.data.user;

beforeAll(async () => {
  await connectTestDB();
  await Promise.all([User.init(), Post.init(), Like.init(), Repost.init(), Follow.init()]);
}, 120_000);
afterAll(async () => { await disconnectTestDB(); });
beforeEach(async () => { await clearCollections(); });

describe('auth is required on every user endpoint', () => {
  it.each([
    ['get', '/users/someone'], ['patch', '/users/me'], ['get', '/users/someone/posts'], ['get', '/users/someone/replies'],
    ['get', '/users/someone/followers'], ['get', '/users/someone/following'],
    ['post', '/users/someone/follow'], ['delete', '/users/someone/follow'],
  ])('%s %s -> 401 without a session', async (method, path) => {
    expect((await request(app)[method](`${API}${path}`).send({ name: 'x' })).status).toBe(401);
  });
});

describe('reserved usernames', () => {
  it.each(['post', 'followers', 'users', 'explore'])('cannot register "%s" (would clash with an app route)', async (name) => {
    const res = await request(app).post(`${API}/auth/register`)
      .send({ name: 'X', username: name, email: `${name}@example.com`, password: 'Passw0rd123' });
    expect(res.status).toBe(400);
  });
});

describe('GET /users/:username', () => {
  it('returns the public profile without private fields', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const res = await a.agent.get(`${API}/users/rohan_v`);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      username: 'rohan_v', name: 'Name rohan_v', bio: '', avatar: '', followerCount: 0, followingCount: 0,
      viewer: { isMe: false, following: false, followedBy: false },
    });
    expect(res.body.data.user.id).toBe(b.user.id);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('email');
    expect(raw).not.toContain('passwordHash');
  });

  it('flags your own profile and is case-insensitive', async () => {
    const a = await signup('anjali_u');
    const res = await a.agent.get(`${API}/users/ANJALI_U`);
    expect(res.body.data.user.viewer.isMe).toBe(true);
  });

  it('404 for unknown users, 400 for malformed usernames', async () => {
    const a = await signup();
    expect((await a.agent.get(`${API}/users/nobody_here`)).status).toBe(404);
    expect((await a.agent.get(`${API}/users/no%20pe`)).status).toBe(400);
    expect((await a.agent.get(`${API}/users/ab`)).status).toBe(400);
  });
});

describe('PATCH /users/me', () => {
  it('updates name, bio and avatar and persists them', async () => {
    const a = await signup('anjali_u');
    const res = await a.agent.patch(`${API}/users/me`).send({ name: ' Anjali U ', bio: 'Full-stack dev', avatar: 'https://example.com/a.png' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ name: 'Anjali U', bio: 'Full-stack dev', avatar: 'https://example.com/a.png', username: 'anjali_u' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const doc = await User.findOne({ username: 'anjali_u' }).select('+passwordHash');
    expect(doc.bio).toBe('Full-stack dev');
    expect(doc.passwordHash).toMatch(/^\$argon2id\$/); // password untouched
    expect((await a.agent.get(`${API}/auth/me`)).body.data.user.bio).toBe('Full-stack dev');
  });

  it('updates only the fields that are sent and can clear bio/avatar', async () => {
    const a = await signup('anjali_u');
    await a.agent.patch(`${API}/users/me`).send({ bio: 'hi', avatar: 'https://example.com/a.png' });
    const res = await a.agent.patch(`${API}/users/me`).send({ bio: '', avatar: '' });
    expect(res.body.data.user).toMatchObject({ bio: '', avatar: '', name: 'Name anjali_u' });
  });

  it('author info on existing posts reflects the new name', async () => {
    const a = await signup('anjali_u');
    const p = await makePost(a.agent, 'my post');
    await a.agent.patch(`${API}/users/me`).send({ name: 'New Name' });
    const res = await a.agent.get(`${API}/posts/${p.id}`);
    expect(res.body.data.post.author.name).toBe('New Name');
  });

  it.each([
    ['empty body', {}],
    ['bio over 160 characters', { bio: 'x'.repeat(161) }],
    ['empty name', { name: '   ' }],
    ['name over 50 characters', { name: 'n'.repeat(51) }],
    ['javascript: avatar URL', { avatar: 'javascript:alert(1)' }],
    ['data: avatar URL', { avatar: 'data:text/html;base64,AAAA' }],
    ['non-string bio', { bio: { $ne: null } }],
  ])('rejects %s (400)', async (_l, body) => {
    const a = await signup();
    expect((await a.agent.patch(`${API}/users/me`).send(body)).status).toBe(400);
  });

  it.each([
    ['username', { username: 'hacker' }], ['email', { email: 'x@y.com' }], ['passwordHash', { passwordHash: 'x' }],
    ['followerCount', { followerCount: 1e6 }], ['id', { _id: '507f1f77bcf86cd799439011' }],
  ])('cannot change %s (mass-assignment guard)', async (_l, body) => {
    const a = await signup('anjali_u');
    expect((await a.agent.patch(`${API}/users/me`).send({ name: 'ok', ...body })).status).toBe(400);
    const doc = await User.findOne({ username: 'anjali_u' });
    expect(doc.followerCount).toBe(0);
    expect(doc.email).toBe('anjali_u@example.com');
  });

  it('counts emoji as one character for the bio limit', async () => {
    const a = await signup();
    expect((await a.agent.patch(`${API}/users/me`).send({ bio: '😀'.repeat(160) })).status).toBe(200);
    expect((await a.agent.patch(`${API}/users/me`).send({ bio: '😀'.repeat(161) })).status).toBe(400);
  });

  it("there is no way to edit someone else's profile (PATCH only targets /me)", async () => {
    const a = await signup('anjali_u'); await signup('rohan_v');
    expect((await a.agent.patch(`${API}/users/rohan_v`).send({ bio: 'pwned' })).status).toBe(404);
    expect((await User.findOne({ username: 'rohan_v' })).bio).toBe('');
  });
});

describe('follow / unfollow', () => {
  it('follows, updates both counters and the viewer flags', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const res = await a.agent.post(`${API}/users/rohan_v/follow`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ following: true, followerCount: 1 });
    const rohan = await profileOf(a.agent, 'rohan_v');
    expect(rohan).toMatchObject({ followerCount: 1, followingCount: 0, viewer: { following: true, followedBy: false } });
    expect((await profileOf(a.agent, 'anjali_u')).followingCount).toBe(1);
    expect((await profileOf(b.agent, 'anjali_u')).viewer).toMatchObject({ following: false, followedBy: true });
  });

  it('is idempotent: following twice counts once', async () => {
    const a = await signup('anjali_u'); await signup('rohan_v');
    await a.agent.post(`${API}/users/rohan_v/follow`);
    const again = await a.agent.post(`${API}/users/rohan_v/follow`);
    expect(again.status).toBe(200);
    expect(again.body.data.followerCount).toBe(1);
    expect(await Follow.countDocuments()).toBe(1);
    expect((await User.findOne({ username: 'anjali_u' })).followingCount).toBe(1);
  });

  it('concurrent follows from the same user create one row', async () => {
    const a = await signup('anjali_u'); await signup('rohan_v');
    await Promise.all([1, 2, 3, 4].map(() => a.agent.post(`${API}/users/rohan_v/follow`)));
    expect(await Follow.countDocuments()).toBe(1);
    expect((await User.findOne({ username: 'rohan_v' })).followerCount).toBe(1);
  });

  it('unfollows and restores counters; unfollowing a stranger never goes negative', async () => {
    const a = await signup('anjali_u'); await signup('rohan_v');
    await a.agent.post(`${API}/users/rohan_v/follow`);
    const res = await a.agent.delete(`${API}/users/rohan_v/follow`);
    expect(res.body.data).toEqual({ following: false, followerCount: 0 });
    expect(await Follow.countDocuments()).toBe(0);
    expect((await a.agent.delete(`${API}/users/rohan_v/follow`)).body.data.followerCount).toBe(0);
    expect((await User.findOne({ username: 'anjali_u' })).followingCount).toBe(0);
  });

  it('cannot follow yourself (400) and counters stay at 0', async () => {
    const a = await signup('anjali_u');
    const res = await a.agent.post(`${API}/users/anjali_u/follow`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/yourself/i);
    expect(await Follow.countDocuments()).toBe(0);
    expect((await User.findOne({ username: 'anjali_u' })).followerCount).toBe(0);
  });

  it('404 when following or unfollowing an unknown user', async () => {
    const a = await signup();
    expect((await a.agent.post(`${API}/users/ghost_user/follow`)).status).toBe(404);
    expect((await a.agent.delete(`${API}/users/ghost_user/follow`)).status).toBe(404);
  });

  it('different users each add one follower', async () => {
    const target = await signup('star_user');
    for (let i = 0; i < 3; i++) { const f = await signup(); await f.agent.post(`${API}/users/star_user/follow`); }
    expect((await profileOf(target.agent, 'star_user')).followerCount).toBe(3);
  });
});

describe('followers / following lists', () => {
  it('lists followers newest first with viewer flags and no private fields', async () => {
    const star = await signup('star_user');
    const f1 = await signup('fan_one'); const f2 = await signup('fan_two');
    await f1.agent.post(`${API}/users/star_user/follow`);
    await f2.agent.post(`${API}/users/star_user/follow`);
    await star.agent.post(`${API}/users/fan_two/follow`); // star follows fan_two back

    const res = await star.agent.get(`${API}/users/star_user/followers`);
    expect(res.status).toBe(200);
    expect(res.body.data.users.map((u) => u.username)).toEqual(['fan_two', 'fan_one']);
    expect(res.body.data.users[0].viewer).toEqual({ isMe: false, following: true });
    expect(res.body.data.users[1].viewer).toEqual({ isMe: false, following: false });
    expect(JSON.stringify(res.body)).not.toContain('email');
    expect(res.body.meta.nextCursor).toBeNull();
  });

  it("lists who a user follows, flagged from the *viewer's* perspective", async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v'); const c = await signup('sara_k');
    await a.agent.post(`${API}/users/sara_k/follow`);
    await a.agent.post(`${API}/users/rohan_v/follow`);
    await b.agent.post(`${API}/users/sara_k/follow`);
    const res = await c.agent.get(`${API}/users/anjali_u/following`);
    expect(res.body.data.users.map((u) => u.username)).toEqual(['rohan_v', 'sara_k']);
    expect(res.body.data.users.every((u) => u.viewer.following === false)).toBe(true);
    const mine = await a.agent.get(`${API}/users/anjali_u/following`);
    expect(mine.body.data.users.every((u) => u.viewer.following === true)).toBe(true);
  });

  it('paginates with a cursor without duplicates', async () => {
    const star = await signup('star_user');
    const names = [];
    for (let i = 0; i < 5; i++) { const f = await signup(`fan_${i}`); names.push(f.username); await f.agent.post(`${API}/users/star_user/follow`); }
    const seen = []; let cursor = null; let pages = 0;
    do {
      const res = await star.agent.get(`${API}/users/star_user/followers`).query({ limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...res.body.data.users.map((u) => u.username));
      cursor = res.body.meta.nextCursor; pages += 1;
    } while (cursor);
    expect(seen).toEqual([...names].reverse());
    expect(pages).toBe(3);
  });

  it('404 for unknown users', async () => {
    const a = await signup();
    expect((await a.agent.get(`${API}/users/ghost_user/followers`)).status).toBe(404);
  });
});

describe("GET /users/:username/posts (their posts + reposts)", () => {
  it('shows their top-level posts, excludes their replies, includes their reposts with repostedBy', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const mine = await makePost(a.agent, 'anjali original');
    await makeReply(a.agent, mine.id, 'anjali reply'); // must not show
    const theirs = await makePost(b.agent, 'rohan original');
    await a.agent.post(`${API}/posts/${theirs.id}/repost`);

    const res = await b.agent.get(`${API}/users/anjali_u/posts`);
    expect(res.status).toBe(200);
    const items = res.body.data.posts;
    expect(items.map((p) => p.text)).toEqual(['rohan original', 'anjali original']); // newest event first
    expect(items[0].repostedBy).toMatchObject({ username: 'anjali_u' });
    expect(items[0].author.username).toBe('rohan_v');
    expect(items[1].repostedBy).toBeUndefined();
    expect(new Set(items.map((p) => p.feedId)).size).toBe(2);
  });

  it('merges posts and reposts in time order and paginates across both without gaps or duplicates', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const order = [];
    for (let i = 1; i <= 3; i++) {
      await makePost(a.agent, `mine ${i}`); order.push(`mine ${i}`);
      const other = await makePost(b.agent, `theirs ${i}`);
      await a.agent.post(`${API}/posts/${other.id}/repost`); order.push(`theirs ${i} (repost)`);
    }
    const seen = []; let cursor = null; let pages = 0;
    do {
      const res = await b.agent.get(`${API}/users/anjali_u/posts`).query({ limit: 2, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      seen.push(...res.body.data.posts.map((p) => (p.repostedBy ? `${p.text} (repost)` : p.text)));
      cursor = res.body.meta.nextCursor; pages += 1;
    } while (cursor);
    expect(seen).toEqual([...order].reverse());
    expect(pages).toBe(3);
  });

  it("includes the viewer's like/repost flags", async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const p = await makePost(a.agent, 'likeable');
    await b.agent.post(`${API}/posts/${p.id}/like`);
    const res = await b.agent.get(`${API}/users/anjali_u/posts`);
    expect(res.body.data.posts[0].viewer).toEqual({ liked: true, reposted: false, bookmarked: false });
  });

  it('repost disappears from the profile when the repost is undone or the original is deleted', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const p1 = await makePost(b.agent, 'one'); const p2 = await makePost(b.agent, 'two');
    await a.agent.post(`${API}/posts/${p1.id}/repost`); await a.agent.post(`${API}/posts/${p2.id}/repost`);
    await a.agent.delete(`${API}/posts/${p1.id}/repost`);
    await b.agent.delete(`${API}/posts/${p2.id}`);
    const res = await b.agent.get(`${API}/users/anjali_u/posts`);
    expect(res.body.data.posts).toEqual([]);
  });
});

describe('GET /users/:username/replies', () => {
  it('lists only their replies, newest first, with the account they replied to', async () => {
    const a = await signup('anjali_u'); const b = await signup('rohan_v');
    const root = await makePost(b.agent, 'rohan root');
    await makePost(a.agent, 'anjali top-level'); // must not show
    await makeReply(a.agent, root.id, 'reply one');
    await makeReply(a.agent, root.id, 'reply two');
    const res = await b.agent.get(`${API}/users/anjali_u/replies`);
    expect(res.body.data.posts.map((p) => p.text)).toEqual(['reply two', 'reply one']);
    expect(res.body.data.posts[0].replyingTo).toBe('rohan_v');
  });

  it('paginates', async () => {
    const a = await signup('anjali_u');
    const root = await makePost(a.agent, 'root');
    for (let i = 1; i <= 3; i++) await makeReply(a.agent, root.id, `r${i}`);
    const p1 = await a.agent.get(`${API}/users/anjali_u/replies`).query({ limit: 2 });
    const p2 = await a.agent.get(`${API}/users/anjali_u/replies`).query({ limit: 2, cursor: p1.body.meta.nextCursor });
    expect([...p1.body.data.posts, ...p2.body.data.posts].map((p) => p.text)).toEqual(['r3', 'r2', 'r1']);
    expect(p2.body.meta.nextCursor).toBeNull();
  });
});

describe('GET /posts/feed?scope=following', () => {
  it('shows your posts + posts/reposts of people you follow, not strangers', async () => {
    const me = await signup('anjali_u'); const friend = await signup('rohan_v'); const stranger = await signup('sara_k');
    await me.agent.post(`${API}/users/rohan_v/follow`);
    await makePost(me.agent, 'my post');
    await makePost(friend.agent, 'friend post');
    const strangerPost = await makePost(stranger.agent, 'stranger post');
    await friend.agent.post(`${API}/posts/${strangerPost.id}/repost`); // friend reposts the stranger's post

    const res = await me.agent.get(`${API}/posts/feed`).query({ scope: 'following' });
    expect(res.status).toBe(200);
    const got = res.body.data.posts.map((p) => (p.repostedBy ? `${p.text} (reposted by ${p.repostedBy.username})` : p.text));
    expect(got).toEqual(['stranger post (reposted by rohan_v)', 'friend post', 'my post']);
  });

  it('only contains your own posts when you follow nobody', async () => {
    const me = await signup('anjali_u'); const other = await signup('rohan_v');
    await makePost(me.agent, 'mine'); await makePost(other.agent, 'theirs');
    const res = await me.agent.get(`${API}/posts/feed`).query({ scope: 'following' });
    expect(res.body.data.posts.map((p) => p.text)).toEqual(['mine']);
  });

  it('a followed user vanishes from the timeline after unfollow', async () => {
    const me = await signup('anjali_u'); const friend = await signup('rohan_v');
    await makePost(friend.agent, 'friend post');
    await me.agent.post(`${API}/users/rohan_v/follow`);
    expect((await me.agent.get(`${API}/posts/feed`).query({ scope: 'following' })).body.data.posts).toHaveLength(1);
    await me.agent.delete(`${API}/users/rohan_v/follow`);
    expect((await me.agent.get(`${API}/posts/feed`).query({ scope: 'following' })).body.data.posts).toHaveLength(0);
  });

  it('excludes replies and paginates', async () => {
    const me = await signup('anjali_u');
    const root = await makePost(me.agent, 'root');
    await makeReply(me.agent, root.id, 'a reply');
    for (let i = 1; i <= 4; i++) await makePost(me.agent, `p${i}`);
    const seen = []; let cursor = null;
    do {
      const res = await me.agent.get(`${API}/posts/feed`).query({ scope: 'following', limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...res.body.data.posts.map((p) => p.text)); cursor = res.body.meta.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['p4', 'p3', 'p2', 'p1', 'root']);
  });

  it('rejects an unknown scope (400) and the global feed is unchanged', async () => {
    const me = await signup('anjali_u'); const other = await signup('rohan_v');
    await makePost(other.agent, 'global post');
    expect((await me.agent.get(`${API}/posts/feed`).query({ scope: 'nope' })).status).toBe(400);
    const global = await me.agent.get(`${API}/posts/feed`);
    expect(global.body.data.posts.map((p) => p.text)).toEqual(['global post']);
  });
});
