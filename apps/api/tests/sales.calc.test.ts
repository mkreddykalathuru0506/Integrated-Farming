import { describe, it, expect } from 'vitest';
import { lineTotalPaise, orderTotalPaise } from '../src/sales/calc';

describe('sales line/order math (integer paise)', () => {
  it('multiplies whole qty by unit price', () => {
    expect(lineTotalPaise(100, 5000)).toBe(500000n); // 100 units @ ₹50
  });

  it('rounds fractional kg to nearest paise', () => {
    expect(lineTotalPaise(12.5, 12345)).toBe(154313n); // 12.5 * 12345 = 154312.5 → 154313
  });

  it('sums line totals to an order total', () => {
    const total = orderTotalPaise([{ lineTotalPaise: 500000n }, { lineTotalPaise: 154313n }]);
    expect(total).toBe(654313n);
  });

  it('handles zero lines', () => {
    expect(orderTotalPaise([])).toBe(0n);
  });
});
