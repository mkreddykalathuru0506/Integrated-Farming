import { Router } from 'express';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import {
  CreateHealthRecordSchema,
  RecordMedicationSchema,
  RecordVaccinationSchema,
  SaleReadySchema,
} from './schemas';
import * as health from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** /api/farm/health — health records, medications, withdrawal gate. */
export const healthRouter = Router();
healthRouter.use(requireAuth, requireFarmAccess);

healthRouter.get(
  '/records',
  asyncHandler(async (req, res) => {
    res.json({
      records: await health.listHealthRecords(farmScope(req).farmId, {
        animalId: q(req.query.animalId),
        batchId: q(req.query.batchId),
      }),
    });
  }),
);

healthRouter.post(
  '/records',
  requireRole('OWNER', 'MANAGER', 'VETERINARIAN'),
  asyncHandler(async (req, res) => {
    const input = CreateHealthRecordSchema.parse(req.body);
    res.status(201).json({ record: await health.createHealthRecord(farmScope(req).farmId, req.userId!, input) });
  }),
);

healthRouter.post(
  '/medications',
  requireRole('OWNER', 'MANAGER', 'VETERINARIAN'),
  asyncHandler(async (req, res) => {
    const input = RecordMedicationSchema.parse(req.body);
    res.status(201).json({ medication: await health.recordMedication(farmScope(req).farmId, req.userId!, input) });
  }),
);

healthRouter.get(
  '/withdrawal',
  asyncHandler(async (req, res) => {
    res.json(
      await health.getWithdrawalStatus(farmScope(req).farmId, {
        animalId: q(req.query.animalId),
        batchId: q(req.query.batchId),
      }),
    );
  }),
);

// Farm-wide active batch withdrawals in one query (member-readable, farm-scoped) —
// the single read surface behind the Health panel's withdrawal table.
healthRouter.get(
  '/withdrawals',
  asyncHandler(async (req, res) => {
    res.json({ withdrawals: await health.listActiveWithdrawals(farmScope(req).farmId) });
  }),
);

healthRouter.post(
  '/sale-ready',
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const input = SaleReadySchema.parse(req.body);
    res.json({ result: await health.markSaleReady(farmScope(req).farmId, req.userId!, input) });
  }),
);

healthRouter.get(
  '/vaccinations',
  asyncHandler(async (req, res) => {
    const batchId = q(req.query.batchId);
    if (!batchId) throw new AppError(400, 'BATCH_REQUIRED', 'batchId query is required');
    res.json(await health.listVaccinations(farmScope(req).farmId, batchId));
  }),
);

healthRouter.post(
  '/vaccinations',
  requireRole('OWNER', 'MANAGER', 'VETERINARIAN'),
  asyncHandler(async (req, res) => {
    const input = RecordVaccinationSchema.parse(req.body);
    res.status(201).json({ event: await health.recordVaccination(farmScope(req).farmId, req.userId!, input) });
  }),
);
