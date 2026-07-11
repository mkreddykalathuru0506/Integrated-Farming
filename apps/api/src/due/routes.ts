import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { dueRollup } from './service';

const DueQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(7),
});

/** /api/farm/due — farm-wide "due this week" rollup. Member read (LABOUR needs today's tasks). */
export const dueRouter = Router();
dueRouter.use(requireAuth, requireFarmAccess);

dueRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { days } = DueQuerySchema.parse(req.query);
    res.json(await dueRollup(farmScope(req).farmId, days));
  }),
);
