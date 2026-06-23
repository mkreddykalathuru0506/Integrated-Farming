import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import * as alerts from './service';

const DispatchSchema = z.object({
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL', 'WEBHOOK', 'PUSH']).optional(),
  recipient: z.string().max(120).optional(),
});

/** /api/farm/alerts — route alerts for open risk flags + list sent. */
export const alertRouter = Router();
alertRouter.use(requireAuth, requireFarmAccess);

alertRouter.get('/', asyncHandler(async (req, res) => res.json({ alerts: await alerts.listAlerts(farmScope(req).farmId) })));

alertRouter.post(
  '/dispatch',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = DispatchSchema.parse(req.body ?? {});
    res.json(await alerts.dispatchAlerts(farmScope(req).farmId, req.userId!, input));
  }),
);

/** /api/farm/dashboard — cross-cutting intelligence summary. */
export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireFarmAccess);
dashboardRouter.get('/', asyncHandler(async (req, res) => res.json(await alerts.dashboard(farmScope(req).farmId))));
