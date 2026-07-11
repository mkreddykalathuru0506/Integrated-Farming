import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import * as intel from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** /api/farm/weather — current weather (cached daily; ?refresh=1 to refetch). */
export const weatherRouter = Router();
weatherRouter.use(requireAuth, requireFarmAccess);
weatherRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const force = q(req.query.refresh) === '1';
    res.json(await intel.getWeather(farmScope(req).farmId, force));
  }),
);

/** /api/farm/risk — rule-based risk flags (read + acknowledge). */
export const riskRouter = Router();
riskRouter.use(requireAuth, requireFarmAccess);
riskRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json({ risks: await intel.listRisks(farmScope(req).farmId, q(req.query.status)) })),
);
riskRouter.post(
  '/:id/ack',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.json({ risk: await intel.acknowledgeRisk(farmScope(req).farmId, req.params.id!, req.userId!) });
  }),
);

/**
 * /api/farm/intelligence — proactive sweep, on demand (slice 11.7). The same sweep body
 * runs daily at 05:30 IST for every located farm via jobs/intelligence-engine.ts; this
 * endpoint forces a fresh weather read for the current farm (web Refresh + demos).
 */
export const intelligenceRouter = Router();
intelligenceRouter.use(requireAuth, requireFarmAccess);
intelligenceRouter.post(
  '/sweep',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.json(await intel.runIntelligenceSweep(farmScope(req).farmId, { force: true }));
  }),
);
