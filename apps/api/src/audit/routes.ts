import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { listActivity } from './service';

const ActivityQuerySchema = z.object({
  cursor: z.string().max(40).optional(), // AuditLog.id of the last item seen
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entity: z.string().max(40).optional(), // exact match, e.g. "Batches"
  action: z.string().max(60).optional(), // exact match, e.g. "batches.advance"
  userId: z.string().max(40).optional(),
  from: z.coerce.date().optional(), // createdAt >= from
  to: z.coerce.date().optional(), // createdAt <= to
});

/**
 * /api/farm/audit — activity feed (read-only; OWNER/MANAGER — a management
 * surface, same gate as GET /members). The write-side security/audit.ts
 * middleware is untouched; GETs here are never audited by design.
 */
export const auditReadRouter = Router();
auditReadRouter.use(requireAuth, requireFarmAccess, requireRole('OWNER', 'MANAGER'));

auditReadRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = ActivityQuerySchema.parse(req.query);
    res.json(await listActivity(farmScope(req).farmId, query));
  }),
);
