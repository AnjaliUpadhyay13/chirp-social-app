import * as svc from '../services/post.service.js';
import * as timeline from '../services/timeline.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';

export const create = asyncHandler(async (req, res) =>
  created(res, { post: await svc.createPost({ user: req.user, text: req.body.text }) }));

export const reply = asyncHandler(async (req, res) =>
  created(res, { post: await svc.createReply({ user: req.user, parentId: req.params.id, text: req.body.text }) }));

export const feed = asyncHandler(async (req, res) => {
  const { scope, ...paging } = req.query;
  const { posts, nextCursor } = scope === 'following'
    ? await timeline.followingFeed({ viewer: req.user, ...paging })
    : await svc.getFeed({ viewer: req.user, ...paging });
  ok(res, { posts }, { nextCursor });
});

export const show = asyncHandler(async (req, res) =>
  ok(res, await svc.getPost({ viewer: req.user, id: req.params.id })));

export const replies = asyncHandler(async (req, res) => {
  const { posts, nextCursor } = await svc.listReplies({ viewer: req.user, id: req.params.id, ...req.query });
  ok(res, { posts }, { nextCursor });
});

export const remove = asyncHandler(async (req, res) =>
  ok(res, await svc.deletePost({ user: req.user, id: req.params.id })));

const interaction = (fn) => asyncHandler(async (req, res) =>
  ok(res, await fn({ user: req.user, id: req.params.id })));

export const like = interaction(svc.like);
export const unlike = interaction(svc.unlike);
export const repost = interaction(svc.repost);
export const unrepost = interaction(svc.unrepost);
