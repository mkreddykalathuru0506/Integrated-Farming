# Spec — Slice 4.2: Feed consumption + FCR

**Phase:** 4 · **Branch:** `phase-4/slice-4.2-fcr` · No schema change (uses FeedTransaction CONSUMPTION + DailyLog WEIGHT)

## Scope
Record feed consumption → decrements stock + attributes feed **cost to a batch**; compute **FCR** per batch. Web consumption form + FCR readout.

## Domain rules
- Consumption: `qty ≤ stockQty` (else `422 INSUFFICIENT_STOCK`); `stockQty -= qty`; `totalPaise = round(qty × lastUnitPricePaise)` (cost attributed to the batch).
- `fcr(feedKg, gainKg)` = `feedKg / gainKg` (pure, tested); `gainKg ≤ 0` → null.
- `weightGainKg` = (latest − earliest) WEIGHT daily-log for the batch; `feedConsumedKg` = Σ CONSUMPTION qty.
- Writes = OWNER/MANAGER/ACCOUNTANT.

## Acceptance
1. Consume 200 kg against a batch → stock down 200; a CONSUMPTION txn with cost (paise) attributed to the batch.
2. Consuming more than stock → `422 INSUFFICIENT_STOCK`.
3. With WEIGHT logs 50 then 150 and 200 kg feed consumed → FCR `2`.
4. LABOUR consume → `403`.

## Tests
- **Unit:** `fcr` (incl. 0 gain → null).
- **Integration:** consume decrements stock + cost; insufficient → 422; FCR from feed + weight logs; LABOUR 403.
