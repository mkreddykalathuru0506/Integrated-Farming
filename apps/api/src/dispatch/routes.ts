import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateDispatchSchema } from './schemas';
import * as dispatch from './service';

/** /api/farm/dispatches — dispatch a confirmed order with cold-chain validation (write = OWNER/MANAGER). */
export const dispatchRouter = Router();
dispatchRouter.use(requireAuth, requireFarmAccess);

dispatchRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json({ dispatches: await dispatch.listDispatches(farmScope(req).farmId) })),
);

dispatchRouter.get(
  '/:id',
  asyncHandler(async (req, res) => res.json({ dispatch: await dispatch.getDispatch(farmScope(req).farmId, req.params.id!) })),
);

dispatchRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateDispatchSchema.parse(req.body);
    res.status(201).json({ dispatch: await dispatch.createDispatch(farmScope(req).farmId, req.userId!, input) });
  }),
);
