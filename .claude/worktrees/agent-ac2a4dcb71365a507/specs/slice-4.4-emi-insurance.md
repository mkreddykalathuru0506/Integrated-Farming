# Spec — Slice 4.4: Loan/EMI + insurance tracking

**Phase:** 4 · **Branch:** `phase-4/slice-4.4-emi-insurance` · Migration `add_loan_insurance`

## Scope
`Loan` + `LoanPayment` + `Insurance` (all money in paise). Record EMI payments; **reminders** for upcoming EMI due + expiring policies. Web EMI/insurance panel.

## Domain rules
- Money (`principalPaise`, `emiAmountPaise`, `premiumPaise`, …) = integer paise.
- `isWithinDays(date, days, now)` (pure, tested) drives reminders: EMI due within 7 days; policies expiring within 30 days.
- Writes = OWNER/MANAGER/ACCOUNTANT.

## Acceptance
1. Create a loan (EMI, next due) + record a payment → `201`.
2. Create an insurance policy (premium, end date) → `201`.
3. Reminders return loans due soon + policies expiring soon.
4. LABOUR write → `403`.

## Tests
- **Unit:** `isWithinDays`.
- **Integration:** create loan + payment; create insurance; reminders surface due/expiring; LABOUR 403.
