import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, formatPaise } from './money';

describe('money (integer paise)', () => {
  it('converts rupees to integer paise', () => {
    expect(rupeesToPaise(1)).toBe(100);
    expect(rupeesToPaise(12.34)).toBe(1234);
    expect(rupeesToPaise(0.1)).toBe(10);
  });

  it('round-trips whole rupees without float drift', () => {
    expect(paiseToRupees(rupeesToPaise(199))).toBe(199);
  });

  it('formats with Indian digit grouping (lakh/crore)', () => {
    expect(formatPaise(0)).toBe('₹0.00');
    expect(formatPaise(100)).toBe('₹1.00');
    expect(formatPaise(123456789)).toBe('₹12,34,567.89');
    expect(formatPaise(-100)).toBe('-₹1.00');
    expect(formatPaise(1234, { withSymbol: false })).toBe('12.34');
  });
});
