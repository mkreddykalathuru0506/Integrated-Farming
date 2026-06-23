import { describe, it, expect } from 'vitest';
import { defaultBand, isOutOfRange } from '../src/cold/calc';

describe('cold-chain bands + out-of-range (§6)', () => {
  it('fresh band is 0–7°C', () => {
    expect(defaultBand('FRESH')).toEqual({ minTempC: 0, maxTempC: 7 });
  });

  it('frozen band tops out at −18°C', () => {
    expect(defaultBand('FROZEN').maxTempC).toBe(-18);
  });

  it('flags fresh meat above 7°C', () => {
    expect(isOutOfRange(9, 0, 7)).toBe(true);
    expect(isOutOfRange(5, 0, 7)).toBe(false);
  });

  it('flags frozen warmer than −18°C', () => {
    expect(isOutOfRange(-10, -30, -18)).toBe(true); // too warm
    expect(isOutOfRange(-20, -30, -18)).toBe(false); // in band
  });

  it('flags below minimum (freezer too cold)', () => {
    expect(isOutOfRange(-35, -30, -18)).toBe(true);
  });
});
