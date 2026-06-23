import { describe, it, expect } from 'vitest';
import { computeLine, splitGst, buildTotals } from '../src/invoices/gst';

describe('computeLine', () => {
  it('taxable = qty×price, gst = taxable×bps/10000 (paise, rounded)', () => {
    expect(computeLine({ qty: 100, unitPricePaise: 5000, gstRateBps: 500 })).toEqual({
      taxablePaise: 500000, // 100 × ₹50 = ₹5000
      gstPaise: 25000, // 5% = ₹250
      lineTotalPaise: 525000,
    });
  });
});

describe('splitGst (invariant: cgst + sgst + igst === gst)', () => {
  it('intra-state splits into equal CGST/SGST', () => {
    expect(splitGst(25000, true)).toEqual({ cgstPaise: 12500, sgstPaise: 12500, igstPaise: 0 });
  });
  it('intra-state odd amount: floor + remainder (still sums)', () => {
    const s = splitGst(25001, true);
    expect(s.cgstPaise + s.sgstPaise + s.igstPaise).toBe(25001);
    expect(s).toEqual({ cgstPaise: 12500, sgstPaise: 12501, igstPaise: 0 });
  });
  it('inter-state → IGST only', () => {
    expect(splitGst(25000, false)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 25000 });
  });
});

describe('buildTotals', () => {
  it('intra-state invoice totals', () => {
    const r = buildTotals([{ qty: 100, unitPricePaise: 5000, gstRateBps: 500 }], true);
    expect(r.subtotalPaise).toBe(500000);
    expect(r.cgstPaise).toBe(12500);
    expect(r.sgstPaise).toBe(12500);
    expect(r.igstPaise).toBe(0);
    expect(r.totalPaise).toBe(525000);
  });
});
