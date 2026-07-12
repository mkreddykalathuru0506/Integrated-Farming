# Spec — Slice 4.1: Feed inventory + purchases + reorder alerts

**Phase:** 4 · **Branch:** `phase-4/slice-4.1-feed-inventory` · Migration `add_feed`

## Scope
`FeedItem` (Decimal stock) + `FeedTransaction` (PURCHASE). A purchase adds stock + records cost (paise, BigInt) + updates last unit price. Low-stock list when `stock < reorderThreshold`. Web FeedPanel. (Consumption + FCR → 4.2.)

## Domain rules
- Feed quantities are `Decimal` (exact fractional kg; not float, not money), transported as strings.
- Money (`unitPricePaise`, `totalPaise`, `lastUnitPricePaise`) = integer **paise** (BigInt) → string transport.
- Purchase: `stockQty += qty`; `lastUnitPricePaise = unitPricePaise`; `totalPaise = round(qty × unitPricePaise)`.
- Writes = OWNER/MANAGER/ACCOUNTANT. Reads = any member. `vendorId` stored as a plain ref (Vendor catalogue lands in 4.5).

## Acceptance (Given/When/Then)
1. Create a feed item (name, unit kg, reorderThreshold) → `201`.
2. Record a purchase (qty, unitPrice ₹) → stock increases by qty; `lastUnitPricePaise` set; cross-farm item → 404/422.
3. Low-stock list returns items whose stock < threshold.
4. LABOUR write → `403`; duplicate item name → `409`.

## Tests
- **Unit:** `purchaseTotalPaise(qtyKg, unitPricePaise)` rounding.
- **Integration:** create item; purchase increases stock + sets price; low-stock list; LABOUR 403; dup name 409.

## DoD
Per CLAUDE.md §2.
