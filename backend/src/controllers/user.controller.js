import * as svc from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

export const profile = asyncHandler(async (req, res) =>
  ok(res, { user: await svc.getProfile({ viewer: req.user, username: req.params.username }) }));

export const updateMe = asyncHandler(async (req, res) =>
  ok(res, { user: await svc.updateProfile({ user: req.user, patch: req.body }) }));

const follows = (fn) => asyncHandler(async (req, res) =>
  ok(res, await fn({ user: req.user, username: req.params.username })));
export const follow = follows(svc.follow);
export const unfollow = follows(svc.unfollow);

const pageOf = (fn, key) => asyncHandler(async (req, res) => {
  const result = await fn({ viewer: req.user, username: req.params.username, ...req.query });
  ok(res, { [key]: result[key] }, { nextCursor: result.nextCursor });
});
export const suggestions = asyncHandler(async (req, res) =>
  ok(res, { users: await svc.suggestions({ viewer: req.user, limit: req.query.limit }) }));
export const followers = pageOf(svc.listFollowers, 'users');
export const following = pageOf(svc.listFollowing, 'users');
export const posts = pageOf(svc.listUserPosts, 'posts');
export const replies = pageOf(svc.listUserReplies, 'posts');
