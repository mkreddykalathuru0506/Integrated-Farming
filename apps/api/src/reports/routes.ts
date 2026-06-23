import { Router } from 'express';
import { asyncHandler } from '../errors';
import { requireAuth, requireFarmAccess } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { buildSummary } from './data';
import { renderSummaryPdf, renderSummaryXlsx } from './render';

const parseDate = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);

/** /api/farm/reports — on-demand farm summary in PDF / Excel. */
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
