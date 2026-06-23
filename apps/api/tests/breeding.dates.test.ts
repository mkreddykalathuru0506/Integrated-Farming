import { describe, it, expect } from 'vitest';
import { addDays } from '../src/breeding/dates';

describe('addDays', () => {
  it('adds whole days', () => {
    const base = new Date('2026-06-01T00:00:00.000Z');
    expect((addDays(base, 283).getTime() - base.getTime()) / 86_400_000).toBe(283);
    expect(addDays(base, 0).getTime()).toBe(base.getTime());
  });
});
