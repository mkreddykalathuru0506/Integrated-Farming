/**
 * Client-side GST preview — an EXACT mirror of `apps/api/src/invoices/gst.ts`
 * (computeLine / splitGst / buildTotals) plus the intra-state test from
 * `createInvoice` in `apps/api/src/invoices/service.ts`.
 *
 * The invoice builder shows a running estimate while the user types; the server
 * remains the source of truth on save. To keep the estimate honest the rounding
 * here MUST match the server byte-for-byte, including its use of Number math
 * (`Math.round(qty * unitPricePaise)`): this is the one sanctioned deviation
 * from the "no Number() paise math" rule, because deviating would make the
 * preview disagree with the stored invoice. Values stay far below 2^53.
 * Keep the two files in lock-step; `gstPreview.test.ts` pins the behaviour.
 */

export type PreviewLineInput = { qty: number; unitPricePaise: number; gstRateBps: number };
export type PreviewComputedLine = { taxablePaise: number; gstPaise: number; lineTotalPaise: number };

/** One line: taxable = qty×price, gst = taxable×bps/10000, both rounded to paise. */
export function computeLine(l: PreviewLineInput): PreviewComputedLine {
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

export type PreviewTotals = {
  computed: PreviewComputedLine[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

/** Build invoice totals from lines. Invariant: cgst + sgst + igst === Σ line gst. */
export function buildTotals(lines: PreviewLineInput[], intraState: boolean): PreviewTotals {
  const computed = lines.map(computeLine);
  const subtotalPaise = computed.reduce((s, c) => s + c.taxablePaise, 0);
  const gstTotal = computed.reduce((s, c) => s + c.gstPaise, 0);
  const split = splitGst(gstTotal, intraState);
  return { computed, subtotalPaise, ...split, totalPaise: subtotalPaise + gstTotal };
}

/**
 * Mirrors the server's place-of-supply test: intra-state (CGST/SGST) only when
 * both states are present and equal after trim + case-fold, otherwise IGST.
 */
export function isIntraState(
  customerState: string | null | undefined,
  farmState: string | null | undefined,
): boolean {
  return Boolean(
    customerState && farmState && customerState.trim().toLowerCase() === farmState.trim().toLowerCase(),
  );
}
