# Spec — Slice 4.5: Vendors/Customers + GST/FSSAI invoice (PDF) + P&L

**Phase:** 4 · **Branch:** `phase-4/slice-4.5-invoices-pnl` · Migration `add_invoicing` · ⚠️ **§1.4 BILLING — pause for owner review before merge**

## Scope
`Vendor`, `Customer`, `Invoice`, `InvoiceLineItem`. GST-compliant invoice with HSN/SAC, **CGST/SGST vs IGST** split, **FSSAI number printed**, sequential numbering; **PDF** via `InvoicePdf` adapter. Batch + farm **P&L** (invoice revenue − feed/expense cost). Web invoice + P&L panel.

## Domain rules (money = integer paise; rates = basis points)
- Per line: `taxable = round(qty × unitPricePaise)`, `gst = round(taxable × gstRateBps / 10000)`, `lineTotal = taxable + gst`.
- **Split:** intra-state (customer.state == farm.state) → CGST = SGST = gst/2 (exact, cgst = floor, sgst = remainder); inter-state → IGST = gst. Invariant: `cgst + sgst + igst == Σ gst`.
- Invoice numbering: gap-free sequential per farm per Indian FY (`INV-<FY>-####`), inside a transaction.
- FSSAI license number snapshotted onto the invoice (FSSAI rule) from farm settings.
- Writes = OWNER/ACCOUNTANT (billing).
- **P&L:** batch revenue = Σ line `lineTotalPaise` where `line.batchId` matches & invoice not cancelled; batch cost = feed consumption + expenses (4.3); profit = revenue − cost. Farm P&L = Σ issued-invoice totals − (Σ expenses + Σ feed consumption).

## Acceptance (Given/When/Then)
1. Intra-state invoice (1 line, qty 100 @ ₹50, 5% GST) → taxable ₹5000, gst ₹250, **CGST ₹125 + SGST ₹125**, IGST 0, total ₹5250; FSSAI printed.
2. Inter-state customer → **IGST** = full gst, CGST/SGST 0.
3. Invoice numbers increment gap-free per farm.
4. `GET /invoices/:id/pdf` returns a PDF (`%PDF` header).
5. Batch P&L = revenue (its invoice lines) − cost; LABOUR create → 403.

## Tests
- **Unit (hard):** `computeLine` rounding; `splitGst` intra/inter + invariant; `buildTotals`.
- **Integration:** create intra-state invoice (GST split + total + FSSAI snapshot); inter-state IGST; sequential numbers; PDF `%PDF`; batch P&L revenue−cost; LABOUR 403.

## DoD
Per CLAUDE.md §2. New dep: `pdfkit` (MIT) behind an `InvoicePdf` interface (+ a mock for tests).
