import * as svc from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { notifications, nextCursor } = await svc.list({ user: req.user, ...req.query });
  ok(res, { notifications }, { nextCursor });
});
export const unread = asyncHandler(async (req, res) => ok(res, { unreadCount: await svc.unreadCount({ user: req.user }) }));
export const read = asyncHandler(async (req, res) => ok(res, await svc.markRead({ user: req.user, id: req.params.id })));
export const readAll = asyncHandler(async (req, res) => ok(res, await svc.markAllRead({ user: req.user })));
