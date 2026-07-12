# Spec — Slice 4.3: Expenses + cost roll-up per batch

**Phase:** 4 · **Branch:** `phase-4/slice-4.3-expenses` · Migration `add_expense`

## Scope
`Expense` (categories, paise) + per-batch **cost roll-up** (feed consumption cost + expenses) + cost-per-bird. Web expenses + batch cost summary. (Revenue/P&L ties in at 4.5 with invoices.)

## Domain rules
- `amountPaise` = integer paise (BigInt → string).
- Batch cost = Σ feed CONSUMPTION `totalPaise` (4.2) + Σ Expense `amountPaise` (batchId); `costPerBirdPaise = total / currentCount` (pure `perUnitPaise`, tested).
- Writes = OWNER/MANAGER/ACCOUNTANT.

## Acceptance
1. Record an expense (MEDICINE, ₹500, batch) → `201`.
2. Batch cost rolls up feed-consumption cost + expenses, with a per-category breakdown + cost-per-bird.
3. Cross-farm batch → `422`; LABOUR write → `403`.

## Tests
- **Unit:** `perUnitPaise` (count 0 → 0).
- **Integration:** create expense; batch-cost = feedCost + expenses + per-bird; LABOUR 403.
