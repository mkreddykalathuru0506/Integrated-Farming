import { describe, it, expect } from 'vitest';
import { rollup } from '../src/byproducts/circularity';

describe('circularity rollup (integer paise)', () => {
  it('sums credit + quantity across transfers', () => {
    const r = rollup([
      { byproductType: 'LITTER', toUnitId: 'u1', quantity: 120, creditPaise: 36000n },
      { byproductType: 'COMPOST', toUnitId: 'u2', quantity: 50, creditPaise: 10000n },
      { byproductType: 'LITTER', toUnitId: 'u2', quantity: 80, creditPaise: 24000n },
    ]);
    expect(r.totalCreditPaise).toBe(70000n);
    expect(r.totalQuantity).toBe(250);
    expect(r.transferCount).toBe(3);
  });

  it('aggregates by type (litter merged), sorted by credit desc', () => {
    const r = rollup([
      { byproductType: 'LITTER', toUnitId: 'u1', quantity: 120, creditPaise: 36000n },
      { byproductType: 'COMPOST', toUnitId: 'u2', quantity: 50, creditPaise: 10000n },
      { byproductType: 'LITTER', toUnitId: 'u2', quantity: 80, creditPaise: 24000n },
    ]);
    expect(r.byType[0]).toEqual({ type: 'LITTER', creditPaise: 60000n, quantity: 200, count: 2 });
    expect(r.byType.find((t) => t.type === 'COMPOST')?.creditPaise).toBe(10000n);
  });

  it('aggregates by destination unit', () => {
    const r = rollup([
      { byproductType: 'LITTER', toUnitId: 'u2', quantity: 80, creditPaise: 24000n },
      { byproductType: 'COMPOST', toUnitId: 'u2', quantity: 50, creditPaise: 10000n },
    ]);
    const u2 = r.byDestination.find((d) => d.unitId === 'u2');
    expect(u2).toEqual({ unitId: 'u2', creditPaise: 34000n, count: 2 });
  });

  it('handles no transfers', () => {
    const r = rollup([]);
    expect(r.totalCreditPaise).toBe(0n);
    expect(r.transferCount).toBe(0);
    expect(r.byType).toEqual([]);
  });
});
