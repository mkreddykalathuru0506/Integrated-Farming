import { Router } from 'express';
import { asyncHandler, AppError } from '../errors';
import { requireAuth, requireFarmAccess, requireRole } from '../auth/middleware';
import { farmScope } from '../auth/scope';
import { CreateCustomerSchema, CreateInvoiceSchema, CreateVendorSchema } from './schemas';
import * as inv from './service';

const q = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** /api/farm/customers */
export const customerRouter = Router();
customerRouter.use(requireAuth, requireFarmAccess);
customerRouter.get('/', asyncHandler(async (req, res) => res.json({ customers: await inv.listCustomers(farmScope(req).farmId) })));
customerRouter.post(
  '/',
  requireRole('OWNER', 'MANAGER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const input = CreateCustomerSchema.parse(req.body);
    res.status(201).json({ customer: await inv.createCustomer(farmScope(req).farmId, req.userId!, input) });
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

/** /api/farm/invoices — billing (create = OWNER/ACCOUNTANT). */
export const invoiceRouter = Router();
invoiceRouter.use(requireAuth, requireFarmAccess);

invoiceRouter.get('/', asyncHandler(async (req, res) => res.json({ invoices: await inv.listInvoices(farmScope(req).farmId) })));

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

invoiceRouter.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const pdf = await inv.renderInvoicePdf(farmScope(req).farmId, req.params.id!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdf);
  }),
);
