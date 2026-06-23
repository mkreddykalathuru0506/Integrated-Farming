import { describe, it, expect } from 'vitest';
import { purchaseTotalPaise } from '../src/feed/calc';

describe('purchaseTotalPaise', () => {
  it('multiplies qty × unit price (paise) and rounds', () => {
    expect(purchaseTotalPaise(10, 5000)).toBe(50000); // 10kg @ ₹50 = ₹500
    expect(purchaseTotalPaise(2.5, 4000)).toBe(10000); // 2.5kg @ ₹40 = ₹100
    expect(purchaseTotalPaise(1.333, 100)).toBe(133); // rounds
  });
});
