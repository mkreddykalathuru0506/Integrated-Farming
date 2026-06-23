import { describe, it, expect } from 'vitest';
import { isDue } from '../src/tasks/engine';

const mondayFirst = new Date('2024-01-01T00:00:00.000Z'); // Monday AND the 1st
const tuesday = new Date('2024-01-02T00:00:00.000Z'); // Tuesday, 2nd

describe('isDue', () => {
  it('DAILY is always due', () => {
    expect(isDue('DAILY', tuesday)).toBe(true);
    expect(isDue('DAILY', mondayFirst)).toBe(true);
  });
  it('WEEKLY is due only on Monday', () => {
    expect(isDue('WEEKLY', mondayFirst)).toBe(true);
    expect(isDue('WEEKLY', tuesday)).toBe(false);
  });
  it('MONTHLY is due only on the 1st', () => {
    expect(isDue('MONTHLY', mondayFirst)).toBe(true);
    expect(isDue('MONTHLY', tuesday)).toBe(false);
  });
});
