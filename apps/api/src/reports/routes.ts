import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { buildSummary } from './data';
import { renderSummaryPdf, renderSummaryXlsx } from './render';
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  runScheduleNow,
  updateReportSchedule,
} from './schedule.service';

const parseDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(120),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  format: z.enum(['pdf', 'xlsx']).optional(),
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL', 'WEBHOOK', 'PUSH']).optional(),
  recipient: z.string().min(1).max(160),
  nextRunAt: z.string().datetime().optional(),
});

/** PATCH body — pause = { isActive: false }; resume may also set nextRunAt. Strict: unknown keys → 400. */
const UpdateScheduleSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    format: z.enum(['pdf', 'xlsx']).optional(),
    channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL', 'WEBHOOK', 'PUSH']).optional(),
    recipient: z.string().min(1).max(160).optional(),
    isActive: z.boolean().optional(),
    nextRunAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'EMPTY_UPDATE' });

/** /api/farm/reports — on-demand farm summary in PDF / Excel + scheduled delivery. */
export const reportRouter = Router();
reportRouter.use(requireAuth, requireFarmAccess);

reportRouter.get(
  '/summary.pdf',
  asyncHandler(async (req, res) => {
    const s = await buildSummary(farmScope(req).farmId, parseDate(req.query.from), parseDate(req.query.to));
    const pdf = await renderSummaryPdf(s);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="farm-summary.pdf"');
    res.send(pdf);
  }),
);

reportRouter.get(
  '/summary.xlsx',
  asyncHandler(async (req, res) => {
    const s = await buildSummary(farmScope(req).farmId, parseDate(req.query.from), parseDate(req.query.to));
    const xlsx = await renderSummaryXlsx(s);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="farm-summary.xlsx"');
    res.send(xlsx);
  }),
);

reportRouter.get(
  '/schedules',
  asyncHandler(async (req, res) => res.json({ schedules: await listReportSchedules(farmScope(req).farmId) })),
);

reportRouter.post(
  '/schedules',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = CreateScheduleSchema.parse(req.body);
    res.status(201).json({ schedule: await createReportSchedule(farmScope(req).farmId, req.userId!, input) });
  }),
);

reportRouter.post(
  '/schedules/:id/run',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => res.json(await runScheduleNow(farmScope(req).farmId, req.params.id!))),
);

reportRouter.patch(
  '/schedules/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = UpdateScheduleSchema.parse(req.body);
    res.json({ schedule: await updateReportSchedule(farmScope(req).farmId, req.userId!, req.params.id!, input) });
  }),
);

reportRouter.delete(
  '/schedules/:id',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => res.json(await deleteReportSchedule(farmScope(req).farmId, req.userId!, req.params.id!))),
);
