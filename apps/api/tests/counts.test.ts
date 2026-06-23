import { describe, it, expect } from 'vitest';
import { isValidLoss } from '../src/livestock/counts';

describe('isValidLoss', () => {
  it('accepts whole numbers from 1..current', () => {
    expect(isValidLoss(100, 1)).toBe(true);
    expect(isValidLoss(100, 100)).toBe(true);
  });
  it('rejects out-of-range and non-integers', () => {
    expect(isValidLoss(100, 0)).toBe(false);
    expect(isValidLoss(100, 101)).toBe(false);
    expect(isValidLoss(100, 1.5)).toBe(false);
    expect(isValidLoss(0, 1)).toBe(false);
  });
});
