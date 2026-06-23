import { describe, it, expect } from 'vitest';
import { categorizeVaccinations, ageInDays } from '../src/health/vaccination';

const items = [
  { id: '1', vaccineName: 'A', type: 'VACCINATION', ageDays: 1 },
  { id: '2', vaccineName: 'B', type: 'VACCINATION', ageDays: 7 },
  { id: '3', vaccineName: 'C', type: 'VACCINATION', ageDays: 42 },
];

describe('categorizeVaccinations', () => {
  it('splits into done / due / upcoming', () => {
    const r = categorizeVaccinations(items, 14, new Set(['A']));
    expect(r.done.map((x) => x.vaccineName)).toEqual(['A']);
    expect(r.due.map((x) => x.vaccineName)).toEqual(['B']);
    expect(r.upcoming.map((x) => x.vaccineName)).toEqual(['C']);
  });
});

describe('ageInDays', () => {
  const now = new Date('2026-06-30T00:00:00.000Z');
  it('is whole days, floored, never negative', () => {
    expect(ageInDays(new Date('2026-06-23T00:00:00.000Z'), now)).toBe(7);
    expect(ageInDays(now, now)).toBe(0);
    expect(ageInDays(new Date('2026-07-05T00:00:00.000Z'), now)).toBe(0);
  });
});
