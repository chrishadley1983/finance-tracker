# FROZEN — Plan E ledger

- `plan-e-ledger-2026-09-03-original.html` + `.pdf`: as written 3 Sep 2026.
- `ifa-e-yearly-2026-09-03-original.mjs`: the model that produced it.
- `plan-e-ledger-revised-2026-09-20.html`: regenerated 20 Sep 2026 by the revised model
  (`scripts/ifa-e-yearly.mjs` as committed alongside this folder) after the audit. The PDF was NOT re-exported.

What the 20 Sep audit changed, and why the two HTML files differ:

1. **Coupon double count / order-size error.** The 3 Sep rung table priced £107.8k redemptions at
   zero-coupon present values (91/89/87…) and the prose added "£8k/yr of coupons on top". Real linkers with
   coupons cost more than that for the same redemption; £909k buys about £98.7k of redemption per ISA rung
   (2035–40) and about £106.3k per SIPP rung (2041–45) at the 17–20 Sep curve, with about £6.8k/yr of coupons paid
   separately. Totals were never wrong — the model accrued the £909k at its yield — only the shape and
   the buyable order sheet were.
2. **Row-year off-by-one.** The 3 Sep model applied a year of growth before the 2026 row, so every balance
   was a year early (the "Total at 2035" was really Sep 2035 taken from the 2034 row). Row 2026 is now the
   1 Sep 2026 balances.
3. **AVC schedule rebased** to the Aug 2026 payslip (£33.5k → £46.2k/yr incl. payroll; was £28.9k → £40.9k).
4. Live yields replace the flat 1.93%: ISA rungs 2.01% portfolio IRR, SIPP rungs 2.29%.

Planning case after (2% real): 2035 £2.28M, 2045 £2.20M, 2075 £2.21M (was £2.26M / £2.16M / £2.13M).

Still known-wrong in BOTH versions (to be carried as knownLimitations into the engine in phase 1):

- Tax-free cash over-counted about £145k real (nominal-frozen LSA and no 25%-of-pot cap), so lifetime drawdown tax
  is about £44k at 2% real, not about £0.
- The sustainable-spend column in section 4 is the 3 Sep outlook figure; £70k/yr does not survive the flat-0% case
  under this ledger's tax rules.
- Personal allowance and thresholds held real forever; IHT on pensions from Apr 2027 unmodelled; platform
  and dealing fees unmodelled; crypto treated as equity.

Phase 1 note (20 Sep 2026, later): `scripts/ifa-e-yearly.mjs` now reads `plan/assumptions.json` and
`plan/observations/gilt-yields/2026-09-20.json`; its outputs match the revised HTML within rounding
(exact budgets £519,516 / £389,874 instead of 519.5k / 389.9k). The HTML is not regenerated again;
generated documents arrive in phase 4.
