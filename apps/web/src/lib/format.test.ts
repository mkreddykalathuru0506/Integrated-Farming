import { describe, expect, it } from 'vitest';
import { fmtDate, fmtDateTime, fmtInr, fmtInrCompact, rupeesToPaise, todayIST } from './format';

describe('todayIST — YYYY-MM-DD in Asia/Kolkata (§6, not UTC)', () => {
  it('returns the IST day, not the UTC day, in the 00:00–05:30 IST window', () => {
    // 2026-07-11T22:30:00Z = 2026-07-12 04:00 IST → the IST day is the 12th
    // (the naive UTC .toISOString().slice(0,10) would wrongly give the 11th).
    const early = new Date('2026-07-11T22:30:00Z');
    expect(todayIST(early)).toBe('2026-07-12');
    expect(early.toISOString().slice(0, 10)).toBe('2026-07-11'); // the bug being fixed
  });

  it('agrees with UTC once past 05:30 IST', () => {
    // 2026-07-11T06:00:00Z = 2026-07-11 11:30 IST → same day as UTC
    expect(todayIST(new Date('2026-07-11T06:00:00Z'))).toBe('2026-07-11');
  });

  it('handles the exact IST midnight rollover (18:30 UTC)', () => {
    // 18:29 UTC = 23:59 IST (still the 11th); 18:30 UTC = 00:00 IST (the 12th)
    expect(todayIST(new Date('2026-07-11T18:29:00Z'))).toBe('2026-07-11');
    expect(todayIST(new Date('2026-07-11T18:30:00Z'))).toBe('2026-07-12');
  });
});

describe('fmtDate — DD-MM-YYYY in Asia/Kolkata (§6)', () => {
  it('formats an ISO timestamp', () => {
    expect(fmtDate('2026-07-11T00:30:00Z')).toBe('11-07-2026'); // 06:00 IST same day
  });

  it('crosses midnight into IST correctly', () => {
    // 20:30 UTC = 02:00 IST the NEXT day
    expect(fmtDate('2026-01-05T20:30:00Z')).toBe('06-01-2026');
  });

  it('accepts a Date object', () => {
    expect(fmtDate(new Date('2026-03-31T12:00:00Z'))).toBe('31-03-2026');
  });

  it('returns empty string for empty/invalid input', () => {
    expect(fmtDate('')).toBe('');
    expect(fmtDate(null)).toBe('');
    expect(fmtDate(undefined)).toBe('');
    expect(fmtDate('not-a-date')).toBe('');
  });
});

describe('fmtDateTime — DD-MM-YYYY, HH:mm (24h) in Asia/Kolkata', () => {
  it('formats date and time', () => {
    expect(fmtDateTime('2026-07-11T09:00:00Z')).toBe('11-07-2026, 14:30'); // +05:30
  });

  it('returns empty string for invalid input', () => {
    expect(fmtDateTime('garbage')).toBe('');
  });
});

describe('fmtInr — integer paise → ₹ with Indian grouping', () => {
  it('formats zero', () => {
    expect(fmtInr(0)).toBe('₹0.00');
  });

  it('formats paise below a rupee', () => {
    expect(fmtInr(5)).toBe('₹0.05');
    expect(fmtInr(99)).toBe('₹0.99');
  });

  it('formats with 2 decimals always', () => {
    expect(fmtInr(12345)).toBe('₹123.45');
    expect(fmtInr(100)).toBe('₹1.00');
  });

  it('uses lakh/crore grouping', () => {
    expect(fmtInr(10000000)).toBe('₹1,00,000.00'); // 1 lakh rupees
    expect(fmtInr(1000000000)).toBe('₹1,00,00,000.00'); // 1 crore rupees
    expect(fmtInr(123456789)).toBe('₹12,34,567.89');
  });

  it('handles negatives', () => {
    expect(fmtInr(-12345)).toBe('-₹123.45');
  });

  it('accepts string and bigint input without precision loss', () => {
    expect(fmtInr('123456789012345678901')).toBe('₹12,34,56,78,90,12,34,56,789.01');
    expect(fmtInr(123n)).toBe('₹1.23');
  });

  it('rejects non-integer/unparseable input', () => {
    expect(fmtInr(1.5)).toBe('');
    expect(fmtInr('abc')).toBe('');
    expect(fmtInr('12.34')).toBe('');
  });
});

describe('fmtInrCompact — ₹ L/Cr compaction (extracted from Dashboard)', () => {
  it('compacts lakhs', () => {
    expect(fmtInrCompact(12400000)).toBe('₹1.24L'); // 1,24,000 rupees
  });

  it('compacts crores', () => {
    expect(fmtInrCompact(2300000000)).toBe('₹2.30Cr'); // 2.3 crore rupees
  });

  it('compacts thousands', () => {
    expect(fmtInrCompact(450000)).toBe('₹4.5k');
  });

  it('keeps small values plain', () => {
    expect(fmtInrCompact(82000)).toBe('₹820');
    expect(fmtInrCompact(0)).toBe('₹0');
  });

  it('handles negatives and strings', () => {
    expect(fmtInrCompact(-12400000)).toBe('-₹1.24L');
    expect(fmtInrCompact('450000')).toBe('₹4.5k');
  });
});

describe('rupeesToPaise — user text → integer-paise string (never floats)', () => {
  it('parses whole rupees', () => {
    expect(rupeesToPaise('0')).toBe('0');
    expect(rupeesToPaise('5')).toBe('500');
    expect(rupeesToPaise(' 5 ')).toBe('500');
  });

  it('parses 1 and 2 decimals', () => {
    expect(rupeesToPaise('12.5')).toBe('1250');
    expect(rupeesToPaise('12.50')).toBe('1250');
    expect(rupeesToPaise('12.55')).toBe('1255');
    expect(rupeesToPaise('.5')).toBe('50');
    expect(rupeesToPaise('0.01')).toBe('1');
  });

  it('rejects more than 2 decimals (paise rounding is not allowed)', () => {
    expect(rupeesToPaise('1.005')).toBeNull();
    expect(rupeesToPaise('0.001')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(rupeesToPaise('abc')).toBeNull();
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise('-')).toBeNull();
    expect(rupeesToPaise('1.2.3')).toBeNull();
    expect(rupeesToPaise('12e3')).toBeNull();
  });

  it('handles negatives (and normalises -0)', () => {
    expect(rupeesToPaise('-5')).toBe('-500');
    expect(rupeesToPaise('-0.50')).toBe('-50');
    expect(rupeesToPaise('-0')).toBe('0');
    expect(rupeesToPaise('-0.00')).toBe('0');
  });

  it('accepts Indian comma grouping', () => {
    expect(rupeesToPaise('1,00,000')).toBe('10000000');
    expect(rupeesToPaise('1,000.25')).toBe('100025');
  });

  it('is exact at large magnitudes (1 lakh, 1 crore, beyond Number.MAX_SAFE_INTEGER)', () => {
    expect(rupeesToPaise('100000')).toBe('10000000'); // 1 lakh
    expect(rupeesToPaise('10000000')).toBe('1000000000'); // 1 crore
    expect(rupeesToPaise('123456789012345678.99')).toBe('12345678901234567899');
  });
});
