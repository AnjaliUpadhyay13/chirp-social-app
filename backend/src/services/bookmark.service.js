import Post from '../models/Post.js';
import Bookmark from '../models/Bookmark.js';
import { ApiError } from '../utils/ApiError.js';
import { hydrate, populateAuthor } from './post.service.js';

async function ensurePost(id) {
  if (!(await Post.exists({ _id: id }))) throw ApiError.notFound('Post not found');
}

// Idempotent: bookmarking twice is a no-op (unique index), removing a missing bookmark is a no-op.
export async function addBookmark({ user, id }) {
  await ensurePost(id);
  try {
    await Bookmark.create({ user: user._id, post: id });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  return { bookmarked: true };
}

export async function removeBookmark({ user, id }) {
  await ensurePost(id);
  await Bookmark.deleteOne({ user: user._id, post: id });
  return { bookmarked: false };
}

// Private: only ever reads the logged-in user's own bookmarks, newest bookmark first.
// The cursor is the bookmark id (not the post id).
export async function listBookmarks({ viewer, cursor, limit }) {
  const query = { user: viewer._id };
  if (cursor) query._id = { $lt: cursor };
  const rows = await Bookmark.find(query).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const posts = slice.length ? await populateAuthor(Post.find({ _id: { $in: slice.map((r) => r.post) } })) : [];
  const byId = new Map(posts.map((p) => [String(p._id), p]));
  const ordered = slice.map((r) => byId.get(String(r.post))).filter(Boolean);

  return { posts: await hydrate(ordered, viewer._id), nextCursor: hasMore ? String(slice[slice.length - 1]._id) : null };
}
