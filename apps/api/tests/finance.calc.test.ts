import { describe, it, expect } from 'vitest';
import { perUnitPaise } from '../src/finance/calc';

describe('perUnitPaise', () => {
  it('divides total by count (floor); count 0 → 0', () => {
    expect(perUnitPaise(100000n, 100)).toBe(1000n); // ₹1000 / 100 = ₹10
    expect(perUnitPaise(1001n, 10)).toBe(100n); // floor
    expect(perUnitPaise(5000n, 0)).toBe(0n);
  });
});
