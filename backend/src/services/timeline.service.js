import Post from '../models/Post.js';
import Repost from '../models/Repost.js';
import Follow from '../models/Follow.js';
import { hydrate, populateAuthor } from './post.service.js';

// A timeline mixes two collections: posts and reposts. Both use time-ordered ObjectIds, so we fetch
// limit+1 from each, merge by id (newest first) and keep `limit`. The cursor is the id of the last item
// (a post id or a repost id), which makes pages stable and free of duplicates or gaps.
// Each item gets `feedId` (unique per timeline entry) and, for reposts, `repostedBy`.
export async function timeline({ viewer, postFilter, repostUserIds = [], cursor, limit }) {
  const cursorFilter = cursor ? { _id: { $lt: cursor } } : {};

  const [posts, reposts] = await Promise.all([
    populateAuthor(Post.find({ ...postFilter, ...cursorFilter }).sort({ _id: -1 }).limit(limit + 1)),
    repostUserIds.length
      ? Repost.find({ user: { $in: repostUserIds }, ...cursorFilter }).sort({ _id: -1 }).limit(limit + 1)
        .populate('user', 'name username avatar').lean()
      : [],
  ]);

  const repostedIds = reposts.map((r) => r.post);
  const repostedPosts = repostedIds.length ? await populateAuthor(Post.find({ _id: { $in: repostedIds } })) : [];
  const byId = new Map(repostedPosts.map((p) => [String(p._id), p]));

  const entries = [
    ...posts.map((p) => ({ key: p._id, post: p })),
    ...reposts.filter((r) => byId.has(String(r.post))).map((r) => ({ key: r._id, post: byId.get(String(r.post)), by: r.user })),
  ].sort((a, b) => (String(a.key) < String(b.key) ? 1 : -1));

  const hasMore = entries.length > limit;
  const slice = hasMore ? entries.slice(0, limit) : entries;
  const hydrated = await hydrate(slice.map((e) => e.post), viewer._id);

  return {
    posts: slice.map((e, i) => ({
      ...hydrated[i],
      feedId: String(e.key),
      ...(e.by ? { repostedBy: { id: String(e.by._id), name: e.by.name, username: e.by.username, avatar: e.by.avatar || '' } } : {}),
    })),
    nextCursor: hasMore ? String(slice[slice.length - 1].key) : null,
  };
}

// "Following" home timeline: your posts + posts and reposts of everyone you follow (top-level posts only).
export async function followingFeed({ viewer, cursor, limit }) {
  const rows = await Follow.find({ follower: viewer._id }).select('following').lean();
  const ids = [viewer._id, ...rows.map((r) => r.following)];
  return timeline({ viewer, postFilter: { author: { $in: ids }, replyTo: null }, repostUserIds: ids, cursor, limit });
}
