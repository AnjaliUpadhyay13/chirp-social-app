import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Follow from '../models/Follow.js';
import { page } from './post.service.js';
import { toPublicUser } from './user.service.js';

// Escape user input so it is matched literally (no regex injection / catastrophic patterns).
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TAG_ONLY = /^#([\p{L}\p{M}\p{N}_]{1,50})$/u;

// People: username or display name contains the text (case-insensitive). Exact > prefix > partial, then popularity.
export async function searchUsers({ viewer, q, limit }) {
  const term = q.replace(/^@/, '').trim().toLowerCase();
  if (!term) return { users: [] };
  const re = new RegExp(escapeRe(term), 'i');

  const rows = await User.find({ $or: [{ username: re }, { name: re }] })
    .sort({ followerCount: -1, _id: -1 }).limit(limit * 3)
    .select('name username bio avatar followerCount followingCount createdAt').lean();

  const rank = (u) => (u.username === term ? 0 : u.username.startsWith(term) ? 1 : 2);
  const top = rows.map((u, i) => ({ u, i })).sort((a, b) => rank(a.u) - rank(b.u) || a.i - b.i).slice(0, limit).map((x) => x.u);

  const mine = top.length
    ? await Follow.find({ follower: viewer._id, following: { $in: top.map((u) => u._id) } }).select('following').lean()
    : [];
  const followed = new Set(mine.map((f) => String(f.following)));
  return {
    users: top.map((u) => toPublicUser(u, { isMe: String(u._id) === String(viewer._id), following: followed.has(String(u._id)) })),
  };
}

// Posts: "#tag" (exactly one hashtag) uses the hashtag index, anything else is a literal substring match on the text.
export async function searchPosts({ viewer, q, cursor, limit }) {
  const term = q.trim();
  const tag = TAG_ONLY.exec(term);
  const filter = tag ? { hashtags: tag[1].toLowerCase() } : { text: new RegExp(escapeRe(term), 'i') };
  return page({ filter, cursor, limit, direction: -1, viewerId: viewer._id });
}

// Trending hashtags over the last `days` days, ranked by how many different people used them (then by post count).
// Counted in application code over the newest posts that have hashtags (bounded) so it behaves identically on every
// MongoDB-compatible database. For very large datasets this is where an aggregation pipeline / cached counters belong.
export async function trending({ days = 7, limit = 10 } = {}) {
  const since = mongoose.Types.ObjectId.createFromTime(Math.floor((Date.now() - days * 86_400_000) / 1000));
  const rows = await Post.find({ _id: { $gte: since }, hashtags: { $ne: [] } })
    .select('author hashtags').sort({ _id: -1 }).limit(5000).lean();

  const stats = new Map();
  for (const r of rows) {
    for (const tag of new Set(r.hashtags)) {
      const s = stats.get(tag) || { tag, posts: 0, authors: new Set() };
      s.posts += 1;
      s.authors.add(String(r.author));
      stats.set(tag, s);
    }
  }
  return [...stats.values()]
    .map((s) => ({ tag: s.tag, posts: s.posts, authors: s.authors.size }))
    .sort((a, b) => b.authors - a.authors || b.posts - a.posts || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
