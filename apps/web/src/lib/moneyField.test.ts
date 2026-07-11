import { describe, expect, it } from 'vitest';
import { rupeeField } from './moneyField';

describe('rupeeField — client money validation matches the API paise schema', () => {
  const required = rupeeField('err');
  const optional = rupeeField('err', true);

  it('rejects negatives (the bug: -2500 passed client zod but 400s server-side)', () => {
    expect(required.safeParse('-2500').success).toBe(false);
    expect(optional.safeParse('-5').success).toBe(false);
  });

  it('accepts a valid non-negative amount with ≤2 decimals', () => {
    expect(required.safeParse('2500').success).toBe(true);
    expect(required.safeParse('1,234.50').success).toBe(true);
    expect(required.safeParse('0').success).toBe(true);
  });

  it('rejects more than 2 decimals and non-numeric input', () => {
    expect(required.safeParse('10.123').success).toBe(false);
    expect(required.safeParse('abc').success).toBe(false);
  });

  it('optional allows empty; required does not', () => {
    expect(optional.safeParse('').success).toBe(true);
    expect(required.safeParse('').success).toBe(false);
  });
});
