import * as search from '../services/search.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

export const run = asyncHandler(async (req, res) => {
  const { type, ...params } = req.query;
  if (type === 'users') return ok(res, await search.searchUsers({ viewer: req.user, ...params }));
  const { posts, nextCursor } = await search.searchPosts({ viewer: req.user, ...params });
  return ok(res, { posts }, { nextCursor });
});

export const trending = asyncHandler(async (req, res) =>
  ok(res, { trends: await search.trending({ limit: req.query.limit }) }));
