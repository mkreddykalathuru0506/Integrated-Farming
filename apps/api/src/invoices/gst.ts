// GST math in integer paise. Rates are basis points (1800 = 18%).
export type LineInput = { qty: number; unitPricePaise: number; gstRateBps: number };
export type ComputedLine = { taxablePaise: number; gstPaise: number; lineTotalPaise: number };

/** One line: taxable = qty×price, gst = taxable×bps/10000, both rounded to paise. */
export function computeLine(l: LineInput): ComputedLine {
  const taxablePaise = Math.round(l.qty * l.unitPricePaise);
  const gstPaise = Math.round((taxablePaise * l.gstRateBps) / 10000);
  return { taxablePaise, gstPaise, lineTotalPaise: taxablePaise + gstPaise };
}

/** Split total GST: intra-state → CGST=SGST (exact halves), inter-state → IGST. */
export function splitGst(gstPaise: number, intraState: boolean) {
  if (intraState) {
    const cgstPaise = Math.floor(gstPaise / 2);
    return { cgstPaise, sgstPaise: gstPaise - cgstPaise, igstPaise: 0 };
  }
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: gstPaise };
}

/** Build invoice totals from lines. Invariant: cgst + sgst + igst === Σ line gst. */
export function buildTotals(lines: LineInput[], intraState: boolean) {
  const computed = lines.map(computeLine);
  const subtotalPaise = computed.reduce((s, c) => s + c.taxablePaise, 0);
  const gstTotal = computed.reduce((s, c) => s + c.gstPaise, 0);
  const split = splitGst(gstTotal, intraState);
  return { computed, subtotalPaise, ...split, totalPaise: subtotalPaise + gstTotal };
}
