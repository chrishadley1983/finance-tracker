# TR40 rung at a fixed £60,000 real redemption (29 Jul 2026 prices)

Observation plan/observations/gilt-prices/2026-07-29.json: TR40 (0 5/8% Index-linked Treasury Gilt 2040)
clean £81.15, dirty £156.06 per £100 nominal.

- Index ratio ≈ dirty / clean = 156.06 / 81.15 = 1.92311
- Face to order = real amount / index ratio = 60,000 / 1.92311 = **£31,199** nominal (golden 31,204, tol 40 — the
  engine divides the unrounded ratio)
- Cost = face / 100 × dirty = 311.99 × 156.06 = **£48,690** (golden 48,696, tol 60); equivalently
  60,000 × clean / 100 = 60,000 × 0.8115 = 48,690 — the cost of £1 of real redemption is clean/100.

This is the June-plan anchor kept as a regression on the fixed-amount path; the plan itself sizes by budget.
