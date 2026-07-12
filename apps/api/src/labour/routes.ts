import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import { CreateWorkerSchema, MarkAttendanceSchema, UpdateWorkerSchema } from './schemas';
import * as labour from './service';

const WorkerListSchema = ListQuerySchema.extend({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

/** /api/farm/workers — worker profiles (member reads; OWNER/MANAGER writes). */
export const workerRouter = Router();
workerRouter.use(requireAuth, requireFarmAccess);

workerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = WorkerListSchema.parse(req.query);
    if (p.page) res.json(await labour.listWorkersPaged(farmScope(req).farmId, p));
    else res.json({ workers: await labour.listWorkers(farmScope(req).farmId, p) });
  }),
);

workerRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateWorkerSchema.parse(req.body);
    res.status(201).json({ worker: await labour.createWorker(farmScope(req).farmId, req.userId!, input) });
  }),
);

workerRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ worker: await labour.getWorker(farmScope(req).farmId, req.params.id!) });
  }),
);

workerRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = UpdateWorkerSchema.parse(req.body);
    res.json({ worker: await labour.updateWorker(farmScope(req).farmId, req.params.id!, req.userId!, input) });
  }),
);

/** /api/farm/attendance — daily attendance (member reads; OWNER/MANAGER marks). */
export const attendanceRouter = Router();
attendanceRouter.use(requireAuth, requireFarmAccess);

attendanceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const date = req.query.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(400, 'DATE_REQUIRED', 'Query ?date=YYYY-MM-DD is required');
    }
    res.json({ attendance: await labour.listAttendance(farmScope(req).farmId, date) });
  }),
);

attendanceRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = MarkAttendanceSchema.parse(req.body);
    res.status(201).json({ attendance: await labour.markAttendance(farmScope(req).farmId, req.userId!, input) });
  }),
);
