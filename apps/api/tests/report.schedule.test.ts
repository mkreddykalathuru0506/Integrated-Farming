import { describe, it, expect } from 'vitest';
import { nextRun } from '../src/reports/schedule.calc';

describe('report schedule nextRun', () => {
  const base = new Date('2026-06-24T06:00:00.000Z');
  it('advances daily by 1 day', () => {
    expect(nextRun(base, 'DAILY').toISOString()).toBe('2026-06-25T06:00:00.000Z');
  });
  it('advances weekly by 7 days', () => {
    expect(nextRun(base, 'WEEKLY').toISOString()).toBe('2026-07-01T06:00:00.000Z');
  });
  it('advances monthly by a calendar month', () => {
    expect(nextRun(base, 'MONTHLY').toISOString()).toBe('2026-07-24T06:00:00.000Z');
  });
});
