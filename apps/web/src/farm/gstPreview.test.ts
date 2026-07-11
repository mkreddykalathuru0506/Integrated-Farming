import { describe, expect, it } from 'vitest';
import { buildTotals, computeLine, isIntraState, splitGst } from './gstPreview';

// Pins the client preview to the server's rounding (apps/api/src/invoices/gst.ts).
describe('gstPreview — exact mirror of the server GST math', () => {
  it('rounds taxable to the nearest paise like the server (qty is a float)', () => {
    // 1.5 × ₹9.99 = 1498.5p → 1499p; 18% of 1499 = 269.82 → 270
    expect(computeLine({ qty: 1.5, unitPricePaise: 999, gstRateBps: 1800 })).toEqual({
      taxablePaise: 1499,
      gstPaise: 270,
      lineTotalPaise: 1769,
    });
  });

  it('splits odd GST intra-state with the extra paise on SGST', () => {
    expect(splitGst(271, true)).toEqual({ cgstPaise: 135, sgstPaise: 136, igstPaise: 0 });
    expect(splitGst(271, false)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 271 });
  });

  it('buildTotals keeps the invariant cgst + sgst + igst === Σ line gst', () => {
    const lines = [
      { qty: 3, unitPricePaise: 12500, gstRateBps: 500 },
      { qty: 2.25, unitPricePaise: 999, gstRateBps: 1800 },
      { qty: 1, unitPricePaise: 100000, gstRateBps: 0 },
    ];
    for (const intra of [true, false]) {
      const t = buildTotals(lines, intra);
      const gst = t.computed.reduce((s, c) => s + c.gstPaise, 0);
      expect(t.cgstPaise + t.sgstPaise + t.igstPaise).toBe(gst);
      expect(t.totalPaise).toBe(t.subtotalPaise + gst);
    }
    // 5% of 37500 = 1875; 2.25×999=2247.75→2248, 18% = 404.64 → 405; 0% line adds none.
    const inter = buildTotals(lines, false);
    expect(inter.subtotalPaise).toBe(37500 + 2248 + 100000);
    expect(inter.igstPaise).toBe(1875 + 405);
  });

  it('isIntraState matches the server: trim + case-fold, both states required', () => {
    expect(isIntraState(' Telangana ', 'telangana')).toBe(true);
    expect(isIntraState('Telangana', 'Andhra Pradesh')).toBe(false);
    expect(isIntraState(null, 'Telangana')).toBe(false);
    expect(isIntraState('Telangana', null)).toBe(false);
    expect(isIntraState('', '')).toBe(false);
  });
});
