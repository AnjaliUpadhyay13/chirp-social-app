import Notification from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';

// ---------- generation (called from the like / repost / reply / follow services) ----------
// Notifications must never break the action that triggered them, so failures are logged, not thrown.
export async function notify({ recipient, actor, type, post = null }) {
  if (String(recipient) === String(actor)) return; // no self-notifications
  try {
    await Notification.create({ recipient, actor, type, post });
  } catch (err) {
    if (err.code !== 11000) console.error('notify failed:', err.message); // 11000 = already notified
  }
}

// Undoing the action (unlike / unrepost / unfollow) withdraws the notification.
// `recipient` is required for follows (post is null there, so it is what pins the notification to one person).
export async function unnotify({ actor, type, post = null, recipient }) {
  try {
    await Notification.deleteMany({ actor, type, post, ...(recipient ? { recipient } : {}) });
  } catch (err) {
    console.error('unnotify failed:', err.message);
  }
}

// ---------- reading (always scoped to the logged-in recipient) ----------
const SNIPPET = 140;

const toApi = (n) => ({
  id: String(n._id),
  type: n.type,
  readAt: n.readAt,
  createdAt: n.createdAt,
  actor: { id: String(n.actor._id), name: n.actor.name, username: n.actor.username, avatar: n.actor.avatar || '' },
  post: n.post ? { id: String(n.post._id), text: n.post.text.length > SNIPPET ? `${n.post.text.slice(0, SNIPPET)}…` : n.post.text } : null,
});

export async function list({ user, cursor, limit }) {
  const query = { recipient: user._id };
  if (cursor) query._id = { $lt: cursor };
  const rows = await Notification.find(query).sort({ _id: -1 }).limit(limit + 1)
    .populate('actor', 'name username avatar').populate('post', 'text').lean();
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const items = slice.filter((n) => n.actor && (n.type === 'follow' || n.post)).map(toApi); // skip dangling refs
  return { notifications: items, nextCursor: hasMore ? String(slice[slice.length - 1]._id) : null };
}

export const unreadCount = ({ user }) => Notification.countDocuments({ recipient: user._id, readAt: null });

// Another user's notification id behaves exactly like a missing one (404).
export async function markRead({ user, id }) {
  const mine = await Notification.exists({ _id: id, recipient: user._id });
  if (!mine) throw ApiError.notFound('Notification not found');
  await Notification.updateOne({ _id: id, recipient: user._id, readAt: null }, { $set: { readAt: new Date() } });
  return { read: true, unreadCount: await unreadCount({ user }) };
}

export async function markAllRead({ user }) {
  const res = await Notification.updateMany({ recipient: user._id, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: res.modifiedCount, unreadCount: 0 };
}
