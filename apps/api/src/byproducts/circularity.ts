/** Pure circularity rollup over byproduct transfers — keeps money in integer paise. */
export type TransferRow = {
  byproductType: string;
  toUnitId: string | null;
  quantity: number; // base unit (kg)
  creditPaise: bigint;
};

export type Circularity = {
  totalCreditPaise: bigint;
  totalQuantity: number;
  transferCount: number;
  byType: { type: string; creditPaise: bigint; quantity: number; count: number }[];
  byDestination: { unitId: string | null; creditPaise: bigint; count: number }[];
};

export function rollup(rows: TransferRow[]): Circularity {
  const byType = new Map<string, { creditPaise: bigint; quantity: number; count: number }>();
  const byDest = new Map<string | null, { creditPaise: bigint; count: number }>();
  let totalCreditPaise = 0n;
  let totalQuantity = 0;

  for (const r of rows) {
    totalCreditPaise += r.creditPaise;
    totalQuantity += r.quantity;

    const tt = byType.get(r.byproductType) ?? { creditPaise: 0n, quantity: 0, count: 0 };
    tt.creditPaise += r.creditPaise;
    tt.quantity += r.quantity;
    tt.count += 1;
    byType.set(r.byproductType, tt);

    const dd = byDest.get(r.toUnitId) ?? { creditPaise: 0n, count: 0 };
    dd.creditPaise += r.creditPaise;
    dd.count += 1;
    byDest.set(r.toUnitId, dd);
  }

  return {
    totalCreditPaise,
    totalQuantity,
    transferCount: rows.length,
    byType: [...byType.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => (b.creditPaise > a.creditPaise ? 1 : -1)),
    byDestination: [...byDest.entries()].map(([unitId, v]) => ({ unitId, ...v })),
  };
}
