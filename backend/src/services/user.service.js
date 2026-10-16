import User from '../models/User.js';
import Post from '../models/Post.js';
import Follow from '../models/Follow.js';
import { ApiError } from '../utils/ApiError.js';
import { page } from './post.service.js';
import { timeline } from './timeline.service.js';

const PUBLIC_FIELDS = 'name username bio avatar followerCount followingCount createdAt';

// Public shape: never includes email or password hash.
export const toPublicUser = (u, viewer) => ({
  id: String(u._id),
  name: u.name,
  username: u.username,
  bio: u.bio || '',
  avatar: u.avatar || '',
  followerCount: u.followerCount,
  followingCount: u.followingCount,
  createdAt: u.createdAt,
  ...(viewer ? { viewer } : {}),
});

async function findUserOr404(username) {
  const user = await User.findOne({ username }).select(PUBLIC_FIELDS).lean();
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

// ---------- profile ----------
export async function getProfile({ viewer, username }) {
  const target = await findUserOr404(username);
  const isMe = String(target._id) === String(viewer._id);
  let following = false;
  let followedBy = false;
  if (!isMe) {
    [following, followedBy] = await Promise.all([
      Follow.exists({ follower: viewer._id, following: target._id }).then(Boolean),
      Follow.exists({ follower: target._id, following: viewer._id }).then(Boolean),
    ]);
  }
  return toPublicUser(target, { isMe, following, followedBy });
}

// Only name / bio / avatar can change (validator is strict). Returns the full "self" user.
export async function updateProfile({ user, patch }) {
  Object.assign(user, patch);
  await user.save();
  return user;
}

// ---------- follow / unfollow (idempotent; counters change only when a Follow row really changes) ----------
const followerCountOf = async (id) => (await User.findById(id).select('followerCount').lean())?.followerCount ?? 0;

export async function follow({ user, username }) {
  const target = await findUserOr404(username);
  if (String(target._id) === String(user._id)) throw ApiError.badRequest("You can't follow yourself");
  try {
    await Follow.create({ follower: user._id, following: target._id });
    await Promise.all([
      User.updateOne({ _id: target._id }, { $inc: { followerCount: 1 } }),
      User.updateOne({ _id: user._id }, { $inc: { followingCount: 1 } }),
    ]);
  } catch (err) {
    if (err.code !== 11000) throw err; // already following => no-op
  }
  return { following: true, followerCount: await followerCountOf(target._id) };
}

export async function unfollow({ user, username }) {
  const target = await findUserOr404(username);
  const res = await Follow.deleteOne({ follower: user._id, following: target._id });
  if (res.deletedCount) {
    await Promise.all([
      User.updateOne({ _id: target._id, followerCount: { $gt: 0 } }, { $inc: { followerCount: -1 } }),
      User.updateOne({ _id: user._id, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
    ]);
  }
  return { following: false, followerCount: await followerCountOf(target._id) };
}

// ---------- followers / following lists ----------
// `field` is which side of the Follow row is shown ('follower' for followers, 'following' for following).
async function userPage({ viewer, filter, field, cursor, limit }) {
  const query = { ...filter };
  if (cursor) query._id = { $lt: cursor };
  const rows = await Follow.find(query).sort({ _id: -1 }).limit(limit + 1).populate(field, PUBLIC_FIELDS).lean();
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const users = slice.map((r) => r[field]).filter(Boolean);

  const mine = users.length
    ? await Follow.find({ follower: viewer._id, following: { $in: users.map((u) => u._id) } }).select('following').lean()
    : [];
  const followed = new Set(mine.map((f) => String(f.following)));

  return {
    users: users.map((u) => toPublicUser(u, { isMe: String(u._id) === String(viewer._id), following: followed.has(String(u._id)) })),
    nextCursor: hasMore ? String(slice[slice.length - 1]._id) : null,
  };
}

export async function listFollowers({ viewer, username, cursor, limit }) {
  const target = await findUserOr404(username);
  return userPage({ viewer, filter: { following: target._id }, field: 'follower', cursor, limit });
}

export async function listFollowing({ viewer, username, cursor, limit }) {
  const target = await findUserOr404(username);
  return userPage({ viewer, filter: { follower: target._id }, field: 'following', cursor, limit });
}

// ---------- a user's timelines ----------
// "Posts" tab: their top-level posts plus their reposts.
export async function listUserPosts({ viewer, username, cursor, limit }) {
  const target = await findUserOr404(username);
  return timeline({ viewer, postFilter: { author: target._id, replyTo: null }, repostUserIds: [target._id], cursor, limit });
}

// "Replies" tab: their replies, each annotated with whom they replied to.
export async function listUserReplies({ viewer, username, cursor, limit }) {
  const target = await findUserOr404(username);
  const { posts, nextCursor } = await page({ filter: { author: target._id, replyTo: { $ne: null } }, cursor, limit, direction: -1, viewerId: viewer._id });

  const parentIds = [...new Set(posts.map((p) => p.replyTo))];
  const parents = parentIds.length ? await Post.find({ _id: { $in: parentIds } }).select('author').populate('author', 'username').lean() : [];
  const nameOf = new Map(parents.map((p) => [String(p._id), p.author?.username]));

  return { posts: posts.map((p) => ({ ...p, replyingTo: nameOf.get(p.replyTo) || null })), nextCursor };
}
