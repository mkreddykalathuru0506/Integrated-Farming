import { describe, it, expect } from 'vitest';
import { isUnderWithdrawal, activeUntil } from '../src/health/withdrawal';

const now = new Date('2026-06-23T00:00:00.000Z');
const future = new Date('2026-06-30T00:00:00.000Z');
const past = new Date('2026-06-01T00:00:00.000Z');

describe('withdrawal gate', () => {
  it('is under withdrawal when any med is still active', () => {
    expect(isUnderWithdrawal([{ withdrawalUntil: future }], now)).toBe(true);
    expect(isUnderWithdrawal([{ withdrawalUntil: past }], now)).toBe(false);
    expect(isUnderWithdrawal([], now)).toBe(false);
    expect(isUnderWithdrawal([{ withdrawalUntil: past }, { withdrawalUntil: future }], now)).toBe(true);
  });

  it('activeUntil returns the latest active date or null', () => {
    expect(activeUntil([{ withdrawalUntil: past }], now)).toBeNull();
    expect(activeUntil([{ withdrawalUntil: future }], now)?.getTime()).toBe(future.getTime());
  });
});
