# Ledger row 2027, ISA ladder balance (longhand)

Inputs: ISA ladder budget £519,516 (Chris II ISA 276,716 + Abby transfer 242,800) at the 17–20 Sep 2026 yields
(plan/observations/gilt-yields/2026-09-20.json). The engine prices each ISA rung per £1 of redemption as
coupon × a(n, y) + (1 + y)^−n with n = maturity year − 2026, sizes the redemption R so the six rungs cost the
budget, then solves the portfolio IRR on the annual flows.

Reproduced outside the engine (spreadsheet, 21 Sep 2026): R = £98,7xx per rung-year, portfolio IRR ≈ 2.01%.

Coupons paid by the ISA rungs in 2027 (real £k) = R × Σ coupon rates of the six ISA gilts
= 98.7 × (1.125 + 0.125 + 1.125 + 1.75 + 0.125 + 0.625)% = 98.7 × 4.875% = **4.81** → the engine's 2027 ISA
coupon (the SIPP adds ~2.0 for the 6.8 total).

Row 2027 ISA ladder balance = 519.516 × 1.0201 − 4.81 = 529.96 − 4.81 = **525.15** £k → golden 525.1 (tol 0.3).
The coupon is reinvested into ISA equity (row 2027 isaEqNew ≈ 4.8).
