import { describe, it, expect } from 'vitest';
import { rate } from '../src/hatchery/rates';

describe('hatchery rate', () => {
  it('returns a percentage (1 decimal); 0 or null → 0', () => {
    expect(rate(100, 80)).toBe(80);
    expect(rate(3, 2)).toBe(66.7);
    expect(rate(0, 5)).toBe(0);
    expect(rate(100, null)).toBe(0);
  });
});
