import { Router } from 'express';
import { z } from 'zod';
import { LogType } from '@prisma/client';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import { CreateLogSchema } from './schemas';
import * as logs from './service';

const LogListSchema = ListQuerySchema.extend({
  type: z.nativeEnum(LogType).optional(),
  batchId: z.string().optional(),
});

/** /api/farm/logs — daily logging. ANY farm member can log (labour included). */
export const logRouter = Router();
logRouter.use(requireAuth, requireFarmAccess);

logRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = LogListSchema.parse(req.query);
    if (p.page) res.json(await logs.listLogsPaged(farmScope(req).farmId, p));
    else res.json({ logs: await logs.listLogs(farmScope(req).farmId, p) });
  }),
);

logRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = CreateLogSchema.parse(req.body);
    res.status(201).json({ log: await logs.createLog(farmScope(req).farmId, req.userId!, input) });
  }),
);
