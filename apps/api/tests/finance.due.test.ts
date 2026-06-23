import { describe, it, expect } from 'vitest';
import { dueWithin } from '../src/finance/calc';

const now = new Date('2026-06-23T00:00:00.000Z');

describe('dueWithin', () => {
  it('is true for dates within the window (and overdue)', () => {
    expect(dueWithin(new Date('2026-06-25T00:00:00.000Z'), 7, now)).toBe(true); // in 2 days
    expect(dueWithin(new Date('2026-06-01T00:00:00.000Z'), 7, now)).toBe(true); // overdue
    expect(dueWithin(new Date('2026-07-30T00:00:00.000Z'), 7, now)).toBe(false); // far future
  });
});
