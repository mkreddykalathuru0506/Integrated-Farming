import { describe, it, expect } from 'vitest';
import { purchaseTotalPaise, fcr } from '../src/feed/calc';

describe('purchaseTotalPaise', () => {
  it('multiplies qty × unit price (paise) and rounds', () => {
    expect(purchaseTotalPaise(10, 5000)).toBe(50000); // 10kg @ ₹50 = ₹500
    expect(purchaseTotalPaise(2.5, 4000)).toBe(10000); // 2.5kg @ ₹40 = ₹100
    expect(purchaseTotalPaise(1.333, 100)).toBe(133); // rounds
  });
});

describe('fcr', () => {
  it('is feed / gain (2dp); null when no gain', () => {
    expect(fcr(200, 100)).toBe(2);
    expect(fcr(180, 100)).toBe(1.8);
    expect(fcr(100, 0)).toBeNull();
    expect(fcr(100, -5)).toBeNull();
  });
});
