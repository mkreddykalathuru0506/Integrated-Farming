import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { AddMemberSchema, ChangeRoleSchema } from './schemas';
import { addMember, changeRole, deactivateMember, getMyFarms, listFarmMembers } from './service';

/** User-level: /api/me/* (auth only, not farm-scoped). */
export const meRouter = Router();
meRouter.get(
  '/farms',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ farms: await getMyFarms(req.userId!) });
  }),
);

/** Tenant-scoped: /api/farm/* (auth + X-Farm-Id membership + role). */
export const farmRouter = Router();
farmRouter.get(
  '/members',
  requireAuth,
  requireFarmAccess,
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { farmId } = farmScope(req);
    res.json({ members: await listFarmMembers(farmId) });
  }),
);

/** Add (or reactivate) a member by email — OWNER only. 201 created, 200 reactivated. */
farmRouter.post(
  '/members',
  requireAuth,
  requireFarmAccess,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const input = AddMemberSchema.parse(req.body);
    const { farmId } = farmScope(req);
    const { member, created } = await addMember(farmId, req.userId!, input);
    res.status(created ? 201 : 200).json({ member });
  }),
);

/** Change a member's role — OWNER only. Last-owner guard enforced in a transaction. */
farmRouter.patch(
  '/members/:userId',
  requireAuth,
  requireFarmAccess,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const input = ChangeRoleSchema.parse(req.body);
    const { farmId } = farmScope(req);
    res.json({ member: await changeRole(farmId, req.params.userId!, input) });
  }),
);

/** Deactivate a member (status → SUSPENDED) — OWNER only. Same last-owner guard. */
farmRouter.delete(
  '/members/:userId',
  requireAuth,
  requireFarmAccess,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { farmId } = farmScope(req);
    res.json({ member: await deactivateMember(farmId, req.params.userId!) });
  }),
);
