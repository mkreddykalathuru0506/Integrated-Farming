import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateLogSchema } from './schemas';
import * as logs from './service';

/** /api/farm/logs — daily logging. ANY farm member can log (labour included). */
export const logRouter = Router();
logRouter.use(requireAuth, requireFarmAccess);

logRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    res.json({ logs: await logs.listLogs(farmScope(req).farmId, { type }) });
  }),
);

logRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = CreateLogSchema.parse(req.body);
    res.status(201).json({ log: await logs.createLog(farmScope(req).farmId, req.userId!, input) });
  }),
);
