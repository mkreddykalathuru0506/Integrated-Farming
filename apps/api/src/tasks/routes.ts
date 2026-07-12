import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { AssignTaskSchema, CompleteTaskSchema, CreateScheduleSchema, CreateTaskSchema } from './schemas';
import * as tasks from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** /api/farm/schedules — recurring templates (member reads; OWNER/MANAGER writes). */
export const scheduleRouter = Router();
scheduleRouter.use(requireAuth, requireFarmAccess);

scheduleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ schedules: await tasks.listSchedules(farmScope(req).farmId) });
  }),
);

scheduleRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateScheduleSchema.parse(req.body);
    res.status(201).json({ schedule: await tasks.createSchedule(farmScope(req).farmId, req.userId!, input) });
  }),
);

/** /api/farm/tasks — task instances. Any member can complete; OWNER/MANAGER create/generate. */
export const taskRouter = Router();
taskRouter.use(requireAuth, requireFarmAccess);

taskRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({
      tasks: await tasks.listTasks(farmScope(req).farmId, {
        date: q(req.query.date),
        status: q(req.query.status),
        assigneeId: q(req.query.assigneeId),
      }),
    });
  }),
);

taskRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateTaskSchema.parse(req.body);
    res.status(201).json({ task: await tasks.createTask(farmScope(req).farmId, req.userId!, input) });
  }),
);

taskRouter.post(
  '/generate',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.json(await tasks.generate(farmScope(req).farmId, q(req.query.date)));
  }),
);

taskRouter.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const { notes } = CompleteTaskSchema.parse(req.body ?? {});
    res.json({ task: await tasks.completeTask(farmScope(req).farmId, req.params.id!, req.userId!, notes) });
  }),
);

taskRouter.patch(
  '/:id/assign',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { workerId } = AssignTaskSchema.parse(req.body);
    res.json({ task: await tasks.assignTask(farmScope(req).farmId, req.params.id!, req.userId!, workerId) });
  }),
);
