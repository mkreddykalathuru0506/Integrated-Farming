import { prisma } from '../prisma';

/** Max hits returned per entity type. */
const PER_TYPE = 5;

/** Web route hint (11.2 nav keys) so the client can navigate(section, { panel }). */
export type RouteHint = { section: string; panel: string };

export type SearchGroup = {
  type: string;
  route: RouteHint;
  items: Record<string, unknown>[];
};

export type SearchResult = { q: string; total: number; groups: SearchGroup[] };

/** Case-insensitive contains filter for one field. */
function ci(q: string) {
  return { contains: q, mode: 'insensitive' as const };
}

/**
 * Global search across the 8 primary entity types. Every sub-query is hard-scoped
 * by farmId (no IDOR — Brief §0.6); soft-deletable models exclude deleted rows.
 * All queries run in parallel; each returns at most PER_TYPE hits.
 * Reads only — reveals nothing a member couldn't already fetch from the list endpoints.
 */
export async function globalSearch(farmId: string, q: string): Promise<SearchResult> {
  const [batches, animals, customers, vendors, invoices, lots, workers, orders] = await Promise.all([
    prisma.batch.findMany({
      where: { farmId, deletedAt: null, OR: [{ code: ci(q) }, { name: ci(q) }] },
      take: PER_TYPE,
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, name: true, status: true },
    }),
    prisma.animal.findMany({
      where: { farmId, deletedAt: null, OR: [{ tagNumber: ci(q) }, { name: ci(q) }] },
      take: PER_TYPE,
      orderBy: { createdAt: 'desc' },
      select: { id: true, tagNumber: true, name: true, status: true },
    }),
    prisma.customer.findMany({
      where: { farmId, deletedAt: null, OR: [{ name: ci(q) }, { phone: ci(q) }] },
      take: PER_TYPE,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    }),
    prisma.vendor.findMany({
      where: { farmId, deletedAt: null, OR: [{ name: ci(q) }, { phone: ci(q) }] },
      take: PER_TYPE,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    }),
    prisma.invoice.findMany({
      where: { farmId, invoiceNumber: ci(q) },
      take: PER_TYPE,
      orderBy: { createdAt: 'desc' },
      select: { id: true, invoiceNumber: true, status: true, issueDate: true, totalPaise: true },
    }),
    prisma.productLot.findMany({
      where: { farmId, deletedAt: null, OR: [{ lotCode: ci(q) }, { productName: ci(q) }] },
      take: PER_TYPE,
      orderBy: { createdAt: 'desc' },
      select: { id: true, lotCode: true, productName: true, state: true, status: true },
    }),
    prisma.worker.findMany({
      where: { farmId, deletedAt: null, OR: [{ name: ci(q) }, { phone: ci(q) }] },
      take: PER_TYPE,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, designation: true },
    }),
    prisma.salesOrder.findMany({
      where: { farmId, deletedAt: null, orderNumber: ci(q) },
      take: PER_TYPE,
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, status: true, totalPaise: true },
    }),
  ]);

  const groups: SearchGroup[] = [];
  const add = (type: string, route: RouteHint, items: Record<string, unknown>[]) => {
    if (items.length > 0) groups.push({ type, route, items });
  };

  add('batch', { section: 'livestock', panel: 'batches' }, batches);
  add('animal', { section: 'livestock', panel: 'animals' }, animals);
  add('customer', { section: 'finance', panel: 'invoices' }, customers);
  add('vendor', { section: 'finance', panel: 'feed' }, vendors);
  add(
    'invoice',
    { section: 'finance', panel: 'invoices' },
    // BigInt paise → string transport (house rule).
    invoices.map((i) => ({ ...i, totalPaise: i.totalPaise.toString() })),
  );
  add('lot', { section: 'sales', panel: 'processing' }, lots);
  add('worker', { section: 'daily', panel: 'workers' }, workers);
  add(
    'order',
    { section: 'sales', panel: 'orders' },
    orders.map((o) => ({ ...o, totalPaise: o.totalPaise.toString() })),
  );

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  return { q, total, groups };
}
