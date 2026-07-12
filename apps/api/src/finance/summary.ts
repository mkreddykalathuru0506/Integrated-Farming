import { prisma } from '../prisma';

const IST_OFFSET_MS = 330 * 60_000; // Asia/Kolkata = UTC+05:30 (no DST)

/** "YYYY-MM" month key of an instant in Asia/Kolkata (pure — unit-tested at midnight bounds). */
export function istMonthKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

/** Start of the current Indian financial year (1 April 00:00 IST) as a UTC instant. */
export function istFyStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const startYear = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  // 1 Apr 00:00 IST = 31 Mar 18:30 UTC
  return new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS);
}

/** Inclusive list of "YYYY-MM" keys from the month of `from` to the month of `to` (IST). */
export function istMonthKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let [y, m] = istMonthKey(from).split('-').map(Number) as [number, number];
  const last = istMonthKey(to);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    keys.push(key);
    if (key === last || keys.length > 240) break; // hard stop: 20 years
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

/**
 * Monthly finance summary (slice 11.5a, read-only): revenue = non-cancelled invoices,
 * expenses = Expense rows, feed cost = CONSUMPTION feed transactions — the same cost
 * definition as farm P&L. Buckets by Asia/Kolkata month; BigInt paise throughout,
 * strings on the wire. Empty months inside the window are emitted with zeros.
 */
export async function financeSummary(farmId: string, opts: { from?: Date; to?: Date }) {
  const now = new Date();
  const from = opts.from ?? istFyStart(now);
  const to = opts.to ?? now;

  const [invoices, expenses, feed] = await Promise.all([
    prisma.invoice.findMany({
      where: { farmId, status: { not: 'CANCELLED' }, issueDate: { gte: from, lte: to } },
      select: { issueDate: true, totalPaise: true },
    }),
    prisma.expense.findMany({
      where: { farmId, occurredAt: { gte: from, lte: to } },
      select: { occurredAt: true, amountPaise: true },
    }),
    prisma.feedTransaction.findMany({
      where: { farmId, type: 'CONSUMPTION', occurredAt: { gte: from, lte: to } },
      select: { occurredAt: true, totalPaise: true },
    }),
  ]);

  const revenue = new Map<string, bigint>();
  const expense = new Map<string, bigint>();
  const feedCost = new Map<string, bigint>();
  const add = (map: Map<string, bigint>, at: Date, paise: bigint) => {
    const key = istMonthKey(at);
    map.set(key, (map.get(key) ?? 0n) + paise);
  };
  for (const i of invoices) add(revenue, i.issueDate, i.totalPaise);
  for (const e of expenses) add(expense, e.occurredAt, e.amountPaise);
  for (const f of feed) add(feedCost, f.occurredAt, f.totalPaise ?? 0n);

  const buckets = istMonthKeysBetween(from, to).map((month) => {
    const rev = revenue.get(month) ?? 0n;
    const exp = expense.get(month) ?? 0n;
    const fc = feedCost.get(month) ?? 0n;
    return {
      month,
      revenuePaise: rev.toString(),
      expensePaise: exp.toString(),
      feedCostPaise: fc.toString(),
      profitPaise: (rev - exp - fc).toString(),
    };
  });

  return { granularity: 'month' as const, from, to, buckets };
}
