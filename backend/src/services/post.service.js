import Post from '../models/Post.js';
import Like from '../models/Like.js';
import Repost from '../models/Repost.js';
import Bookmark from '../models/Bookmark.js';
import Notification from '../models/Notification.js';
import { notify, unnotify } from './notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { extractHashtags } from '../utils/hashtags.js';

const MAX_THREAD_DEPTH = 100;
const AUTHOR_FIELDS = 'name username avatar';

// ---------- serialisation ----------
const idOf = (v) => (v ? String(v._id ?? v) : null);

function toApi(post, liked, reposted, bookmarked) {
  const a = post.author;
  return {
    id: idOf(post),
    text: post.text,
    hashtags: post.hashtags || [],
    author: a && a.username
      ? { id: idOf(a), name: a.name, username: a.username, avatar: a.avatar || '' }
      : { id: null, name: 'Deleted user', username: 'deleted', avatar: '' },
    replyTo: idOf(post.replyTo),
    rootPost: idOf(post.rootPost),
    likeCount: post.likeCount,
    replyCount: post.replyCount,
    repostCount: post.repostCount,
    createdAt: post.createdAt,
    viewer: { liked, reposted, bookmarked },
  };
}

// Adds per-viewer flags (liked / reposted / bookmarked) with 3 batched queries (no N+1).
export async function hydrate(posts, viewerId) {
  if (!posts.length) return [];
  const ids = posts.map((p) => p._id);
  const [likes, reposts, bookmarks] = await Promise.all([
    Like.find({ user: viewerId, post: { $in: ids } }).select('post').lean(),
    Repost.find({ user: viewerId, post: { $in: ids } }).select('post').lean(),
    Bookmark.find({ user: viewerId, post: { $in: ids } }).select('post').lean(),
  ]);
  const liked = new Set(likes.map((l) => String(l.post)));
  const reposted = new Set(reposts.map((r) => String(r.post)));
  const bookmarked = new Set(bookmarks.map((b) => String(b.post)));
  return posts.map((p) => toApi(p, liked.has(String(p._id)), reposted.has(String(p._id)), bookmarked.has(String(p._id))));
}

export const populateAuthor = (q) => q.populate('author', AUTHOR_FIELDS).lean();

async function findPostOr404(id) {
  const post = await Post.findById(id).lean();
  if (!post) throw ApiError.notFound('Post not found');
  return post;
}

// ---------- create ----------
export async function createPost({ user, text }) {
  const doc = await Post.create({ author: user._id, text, hashtags: extractHashtags(text) });
  const post = await populateAuthor(Post.findById(doc._id));
  return (await hydrate([post], user._id))[0];
}

export async function createReply({ user, parentId, text }) {
  const parent = await findPostOr404(parentId);
  if (parent.ancestors.length >= MAX_THREAD_DEPTH) throw ApiError.badRequest('This conversation is too deep to reply to');

  const doc = await Post.create({
    author: user._id,
    text,
    hashtags: extractHashtags(text),
    replyTo: parent._id,
    rootPost: parent.rootPost || parent._id,
    ancestors: [...parent.ancestors, parent._id],
  });
  await Post.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });
  await notify({ recipient: parent.author, actor: user._id, type: 'reply', post: doc._id });

  const post = await populateAuthor(Post.findById(doc._id));
  return (await hydrate([post], user._id))[0];
}

// ---------- read ----------
// Cursor = _id of the last item of the previous page (ObjectIds are time-ordered and unique => stable pages).
export async function page({ filter, cursor, limit, direction, viewerId }) {
  const query = { ...filter };
  if (cursor) query._id = { [direction === 1 ? '$gt' : '$lt']: cursor };
  const rows = await populateAuthor(Post.find(query).sort({ _id: direction }).limit(limit + 1));
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    posts: await hydrate(slice, viewerId),
    nextCursor: hasMore ? String(slice[slice.length - 1]._id) : null,
  };
}

// Phase 3: global timeline of top-level posts (replies excluded), newest first.
// Phase 4 will add a "following" timeline once follows exist.
export const getFeed = ({ viewer, cursor, limit }) =>
  page({ filter: { replyTo: null }, cursor, limit, direction: -1, viewerId: viewer._id });

export async function getPost({ viewer, id }) {
  const post = await populateAuthor(Post.findById(id));
  if (!post) throw ApiError.notFound('Post not found');

  let ancestors = [];
  if (post.ancestors.length) {
    const rows = await populateAuthor(Post.find({ _id: { $in: post.ancestors } }));
    const order = new Map(post.ancestors.map((a, i) => [String(a), i]));
    rows.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id))); // root first
    ancestors = await hydrate(rows, viewer._id);
  }
  const [hydrated] = await hydrate([post], viewer._id);
  return { post: hydrated, ancestors };
}

export async function listReplies({ viewer, id, cursor, limit }) {
  await findPostOr404(id);
  // Oldest first = conversation order
  return page({ filter: { replyTo: id }, cursor, limit, direction: 1, viewerId: viewer._id });
}

// ---------- delete ----------
export async function deletePost({ user, id }) {
  const post = await findPostOr404(id);
  if (String(post.author) !== String(user._id)) throw ApiError.forbidden('You can only delete your own posts');

  // The post plus its whole reply subtree
  const subtree = await Post.find({ ancestors: post._id }).select('_id').lean();
  const ids = [post._id, ...subtree.map((p) => p._id)];

  await Promise.all([
    Like.deleteMany({ post: { $in: ids } }),
    Repost.deleteMany({ post: { $in: ids } }),
    Bookmark.deleteMany({ post: { $in: ids } }),
    Notification.deleteMany({ post: { $in: ids } }),
  ]);
  await Post.deleteMany({ _id: { $in: ids } });
  if (post.replyTo) await Post.updateOne({ _id: post.replyTo }, { $inc: { replyCount: -1 } });

  return { deleted: true, removed: ids.length };
}

// ---------- like / repost (idempotent, counters change only when the row really changes) ----------
async function counterOf(id, field) {
  const doc = await Post.findById(id).select(field).lean();
  return doc?.[field] ?? 0;
}

async function addInteraction(Model, field, { user, id }) {
  const post = await findPostOr404(id);
  let created = false;
  try {
    await Model.create({ user: user._id, post: id });
    await Post.updateOne({ _id: id }, { $inc: { [field]: 1 } });
    created = true;
  } catch (err) {
    if (err.code !== 11000) throw err; // already exists => no-op (double click, race, retry)
  }
  return { count: await counterOf(id, field), created, post };
}

async function removeInteraction(Model, field, { user, id }) {
  await findPostOr404(id);
  const res = await Model.deleteOne({ user: user._id, post: id });
  if (res.deletedCount) await Post.updateOne({ _id: id, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
  return { count: await counterOf(id, field), removed: res.deletedCount > 0 };
}

// Notify the post's author only when the like/repost row was really created (not on an idempotent repeat).
async function add(Model, field, type, args) {
  const { count, created, post } = await addInteraction(Model, field, args);
  if (created) await notify({ recipient: post.author, actor: args.user._id, type, post: post._id });
  return count;
}

// Undoing withdraws the notification, so like -> unlike -> like yields exactly one (fresh, unread) notification.
async function remove(Model, field, type, args) {
  const { count, removed } = await removeInteraction(Model, field, args);
  if (removed) await unnotify({ actor: args.user._id, type, post: args.id });
  return count;
}

export const like = async (args) => ({ liked: true, likeCount: await add(Like, 'likeCount', 'like', args) });
export const unlike = async (args) => ({ liked: false, likeCount: await remove(Like, 'likeCount', 'like', args) });
export const repost = async (args) => ({ reposted: true, repostCount: await add(Repost, 'repostCount', 'repost', args) });
export const unrepost = async (args) => ({ reposted: false, repostCount: await remove(Repost, 'repostCount', 'repost', args) });
