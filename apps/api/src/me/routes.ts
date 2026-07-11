import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth } from '../auth/middleware';
import { auditSafe } from '../auth/service';
import { UpdateMeSchema, RevokeOthersSchema } from './schemas';
import { updateMe, listSessions, revokeSession, revokeOtherSessions } from './service';

/**
 * Profile + session management for the authenticated user (slice 11.3).
 * Mounted at /api/me alongside the rbac meRouter (GET /api/me/farms).
 * Not farm-scoped by design — these operate on the caller's own account only,
 * so the guard is requireAuth + "userId must match" inside each service call.
 * /api/me is outside the auditWrite middleware → each write audits directly.
 */
export const profileRouter = Router();

profileRouter.patch(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = UpdateMeSchema.parse(req.body);
    const user = await updateMe(req.userId!, input);
    await auditSafe(req.userId!, 'user.profile.update', req.userId!, req.ip);
    res.status(200).json({ user });
  }),
);

profileRouter.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({ sessions: await listSessions(req.userId!) });
  }),
);

profileRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeSession(req.userId!, req.params.id!);
    await auditSafe(req.userId!, 'user.session.revoke', req.params.id!, req.ip);
    res.status(200).json({ ok: true });
  }),
);

profileRouter.post(
  '/sessions/revoke-others',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { refreshToken } = RevokeOthersSchema.parse(req.body);
    const revoked = await revokeOtherSessions(req.userId!, refreshToken);
    await auditSafe(req.userId!, 'user.session.revoke_others', req.userId!, req.ip);
    res.status(200).json({ revoked });
  }),
);
