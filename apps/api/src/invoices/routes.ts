import { Router } from 'express';
import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { ListQuerySchema } from '../http/list-query';
import {
  CreateCustomerSchema,
  CreateInvoiceSchema,
  CreateVendorSchema,
  UpdateCustomerSchema,
  UpdateVendorSchema,
} from './schemas';
import * as inv from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

const InvoiceListSchema = ListQuerySchema.extend({ status: z.nativeEnum(InvoiceStatus).optional() });

/** /api/farm/customers */
export const customerRouter = Router();
customerRouter.use(requireAuth, requireFarmAccess);
customerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = ListQuerySchema.parse(req.query);
    if (p.page) res.json(await inv.listCustomersPaged(farmScope(req).farmId, p));
    else res.json({ customers: await inv.listCustomers(farmScope(req).farmId, p) });
  }),
);
customerRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateCustomerSchema.parse(req.body);
    res.status(201).json({ customer: await inv.createCustomer(farmScope(req).farmId, req.userId!, input) });
  }),
);
customerRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = UpdateCustomerSchema.parse(req.body);
    res.json({ customer: await inv.updateCustomer(farmScope(req).farmId, req.userId!, req.params.id!, input) });
  }),
);

/** /api/farm/vendors */
export const vendorRouter = Router();
vendorRouter.use(requireAuth, requireFarmAccess);
vendorRouter.get('/', asyncHandler(async (req, res) => res.json({ vendors: await inv.listVendors(farmScope(req).farmId) })));
vendorRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateVendorSchema.parse(req.body);
    res.status(201).json({ vendor: await inv.createVendor(farmScope(req).farmId, req.userId!, input) });
  }),
);
vendorRouter.patch(
  '/:id',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = UpdateVendorSchema.parse(req.body);
    res.json({ vendor: await inv.updateVendor(farmScope(req).farmId, req.userId!, req.params.id!, input) });
  }),
);

/** /api/farm/invoices — billing (create = OWNER/ACCOUNTANT). */
export const invoiceRouter = Router();
invoiceRouter.use(requireAuth, requireFarmAccess);

invoiceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const p = InvoiceListSchema.parse(req.query);
    if (p.page) res.json(await inv.listInvoicesPaged(farmScope(req).farmId, p));
    else res.json({ invoices: await inv.listInvoices(farmScope(req).farmId, p) });
  }),
);

invoiceRouter.get('/pnl/farm', asyncHandler(async (req, res) => res.json(await inv.farmPnl(farmScope(req).farmId))));

invoiceRouter.get(
  '/pnl/batch',
  asyncHandler(async (req, res) => {
    const batchId = q(req.query.batchId);
    if (!batchId) throw new AppError(400, 'BATCH_REQUIRED', 'batchId query is required');
    res.json(await inv.batchPnl(farmScope(req).farmId, batchId));
  }),
);

invoiceRouter.post(
  '/',
  requireRole('OWNER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateInvoiceSchema.parse(req.body);
    res.status(201).json({ invoice: await inv.createInvoice(farmScope(req).farmId, req.userId!, input) });
  }),
);

// Money/billing lifecycle — same roles as invoice create (OWNER/ACCOUNTANT).
invoiceRouter.post(
  '/:id/mark-paid',
  requireRole('OWNER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    res.json({ invoice: await inv.markInvoicePaid(farmScope(req).farmId, req.userId!, req.params.id!) });
  }),
);

invoiceRouter.post(
  '/:id/void',
  requireRole('OWNER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    res.json({ invoice: await inv.voidInvoice(farmScope(req).farmId, req.userId!, req.params.id!) });
  }),
);

invoiceRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const pdf = await inv.renderInvoicePdf(farmScope(req).farmId, req.params.id!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);

// Invoice detail JSON. Registered after /pnl/* and POST so those static paths win.
invoiceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ invoice: await inv.getInvoice(farmScope(req).farmId, req.params.id!) });
  }),
);
