import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { buildTotals } from './gst';
import { PdfKitInvoicePdf, type InvoiceForPdf } from './pdf';
import { batchCost } from '../finance/service';
import type { CreateCustomerInput, CreateInvoiceInput, CreateVendorInput } from './schemas';

export async function createCustomer(farmId: string, userId: string, input: CreateCustomerInput) {
  try {
    return await prisma.customer.create({
      data: { farmId, ...input, createdBy: userId },
      select: { id: true, name: true, gstin: true, state: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'CUSTOMER_NAME_TAKEN', 'A customer with this name already exists');
    }
    throw err;
  }
}

export async function listCustomers(farmId: string) {
  return prisma.customer.findMany({
    where: { farmId, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, gstin: true, state: true },
  });
}

export async function createVendor(farmId: string, userId: string, input: CreateVendorInput) {
  try {
    return await prisma.vendor.create({
      data: { farmId, ...input, createdBy: userId },
      select: { id: true, name: true, gstin: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'VENDOR_NAME_TAKEN', 'A vendor with this name already exists');
    }
    throw err;
  }
}

export async function listVendors(farmId: string) {
  return prisma.vendor.findMany({ where: { farmId, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, gstin: true } });
}

/** Indian financial year label for a date (Apr–Mar), e.g. "2026-27". */
function financialYear(d: Date): string {
  const y = d.getUTCFullYear();
  const startYear = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function toInvoiceDTO(inv: {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  subtotalPaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalPaise: bigint;
  fssaiLicenseNo: string | null;
}) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    issueDate: inv.issueDate,
    subtotalPaise: inv.subtotalPaise.toString(),
    cgstPaise: inv.cgstPaise.toString(),
    sgstPaise: inv.sgstPaise.toString(),
    igstPaise: inv.igstPaise.toString(),
    totalPaise: inv.totalPaise.toString(),
    fssaiLicenseNo: inv.fssaiLicenseNo,
  };
}

const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  status: true,
  issueDate: true,
  subtotalPaise: true,
  cgstPaise: true,
  sgstPaise: true,
  igstPaise: true,
  totalPaise: true,
  fssaiLicenseNo: true,
} satisfies Prisma.InvoiceSelect;

export async function createInvoice(farmId: string, userId: string, input: CreateInvoiceInput) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, farmId, deletedAt: null } });
  if (!customer) throw new AppError(422, 'INVALID_CUSTOMER', 'Customer does not belong to this farm');

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { state: true, settings: { select: { fssaiLicenseNo: true } } } });
  const intraState = Boolean(customer.state && farm?.state && customer.state.trim().toLowerCase() === farm.state.trim().toLowerCase());

  const totals = buildTotals(
    input.lines.map((l) => ({ qty: l.qty, unitPricePaise: Number(l.unitPricePaise), gstRateBps: l.gstRateBps })),
    intraState,
  );

  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const fy = financialYear(issueDate);

  const invoice = await prisma.$transaction(async (tx) => {
    const count = await tx.invoice.count({ where: { farmId, invoiceNumber: { startsWith: `INV-${fy}-` } } });
    const invoiceNumber = `INV-${fy}-${String(count + 1).padStart(4, '0')}`;
    return tx.invoice.create({
      data: {
        farmId,
        invoiceNumber,
        customerId: customer.id,
        issueDate,
        subtotalPaise: BigInt(totals.subtotalPaise),
        cgstPaise: BigInt(totals.cgstPaise),
        sgstPaise: BigInt(totals.sgstPaise),
        igstPaise: BigInt(totals.igstPaise),
        totalPaise: BigInt(totals.totalPaise),
        fssaiLicenseNo: farm?.settings?.fssaiLicenseNo ?? null,
        placeOfSupplyState: customer.state,
        notes: input.notes,
        createdBy: userId,
        lines: {
          create: input.lines.map((l, i) => ({
            description: l.description,
            hsnSac: l.hsnSac,
            qty: new Prisma.Decimal(l.qty),
            unitPricePaise: BigInt(l.unitPricePaise),
            gstRateBps: l.gstRateBps,
            taxablePaise: BigInt(totals.computed[i]!.taxablePaise),
            gstPaise: BigInt(totals.computed[i]!.gstPaise),
            lineTotalPaise: BigInt(totals.computed[i]!.lineTotalPaise),
            batchId: l.batchId,
          })),
        },
      },
      select: INVOICE_SELECT,
    });
  });

  return toInvoiceDTO(invoice);
}

export async function listInvoices(farmId: string) {
  const rows = await prisma.invoice.findMany({ where: { farmId }, orderBy: { issueDate: 'desc' }, select: INVOICE_SELECT });
  return rows.map(toInvoiceDTO);
}

export async function renderInvoicePdf(farmId: string, id: string): Promise<Buffer> {
  const inv = await prisma.invoice.findFirst({
    where: { id, farmId },
    select: {
      invoiceNumber: true,
      issueDate: true,
      fssaiLicenseNo: true,
      subtotalPaise: true,
      cgstPaise: true,
      sgstPaise: true,
      igstPaise: true,
      totalPaise: true,
      customer: { select: { name: true, gstin: true } },
      lines: { select: { description: true, hsnSac: true, qty: true, unitPricePaise: true, gstRateBps: true, lineTotalPaise: true } },
    },
  });
  if (!inv) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
  const forPdf: InvoiceForPdf = {
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    fssaiLicenseNo: inv.fssaiLicenseNo,
    customerName: inv.customer.name,
    customerGstin: inv.customer.gstin,
    subtotalPaise: inv.subtotalPaise,
    cgstPaise: inv.cgstPaise,
    sgstPaise: inv.sgstPaise,
    igstPaise: inv.igstPaise,
    totalPaise: inv.totalPaise,
    lines: inv.lines.map((l) => ({ ...l, qty: l.qty.toString() })),
  };
  return new PdfKitInvoicePdf().render(forPdf);
}

export async function batchPnl(farmId: string, batchId: string) {
  const lines = await prisma.invoiceLineItem.findMany({
    where: { batchId, invoice: { farmId, status: { not: 'CANCELLED' } } },
    select: { lineTotalPaise: true },
  });
  const revenuePaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0n);
  const cost = await batchCost(farmId, batchId);
  const costPaise = BigInt(cost.totalPaise);
  return {
    revenuePaise: revenuePaise.toString(),
    costPaise: costPaise.toString(),
    profitPaise: (revenuePaise - costPaise).toString(),
  };
}

export async function farmPnl(farmId: string) {
  const [invoices, expenses, feed] = await Promise.all([
    prisma.invoice.findMany({ where: { farmId, status: { not: 'CANCELLED' } }, select: { totalPaise: true } }),
    prisma.expense.findMany({ where: { farmId }, select: { amountPaise: true } }),
    prisma.feedTransaction.findMany({ where: { farmId, type: 'CONSUMPTION' }, select: { totalPaise: true } }),
  ]);
  const revenuePaise = invoices.reduce((s, i) => s + i.totalPaise, 0n);
  const costPaise =
    expenses.reduce((s, e) => s + e.amountPaise, 0n) + feed.reduce((s, f) => s + (f.totalPaise ?? 0n), 0n);
  return {
    revenuePaise: revenuePaise.toString(),
    costPaise: costPaise.toString(),
    profitPaise: (revenuePaise - costPaise).toString(),
  };
}
