import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateOrderSchema, UpdateOrderStatusSchema } from './schemas';
import * as sales from './service';

/** /api/farm/orders — sales orders (write = OWNER/MANAGER/ACCOUNTANT). */
export const orderRouter = Router();
orderRouter.use(requireAuth, requireFarmAccess);

orderRouter.get(
  '/',
  asyncHandler(async (req, res) => res.json({ orders: await sales.listOrders(farmScope(req).farmId) })),
);

orderRouter.get(
  '/:id',
  asyncHandler(async (req, res) => res.json({ order: await sales.getOrder(farmScope(req).farmId, req.params.id!) })),
);

orderRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateOrderSchema.parse(req.body);
    res.status(201).json({ order: await sales.createOrder(farmScope(req).farmId, req.userId!, input) });
  }),
);

orderRouter.patch(
  '/:id/status',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = UpdateOrderStatusSchema.parse(req.body);
    res.json({ order: await sales.setOrderStatus(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);
