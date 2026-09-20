# Done Criteria — plan-cockpit

**Feature:** Plan Cockpit — interactive financial-plan dashboard at `/plan`
**Defined:** 2026-07-30 · **Iteration budget:** 5
**Reference for all model numbers:** `plan/runs/2026-07-30-amendment-1/investment-plan-amendment-1-2026-07.md` (the July 2026 plan, FROZEN). Numeric anchors below are the APRIL-payslip figures and were superseded on 20 Sep 2026 by the Aug payslip rebase — see `plan/decisions.md` and `tests/unit/plan/*.test.ts` for the current anchors. Where a criterion cites a number, that document is the source of truth.

**Problem:** The household plan (pots, pension pivot, gilt ladder, retirement outlook) lives in a static PDF and session models. Chris wants it interactive, live where cheap, and behind the app's existing login rather than on a public page.

---

## Functional criteria

### F1: Route exists behind auth `AUTO_VERIFY`
`/plan` renders for an authenticated session. An unauthenticated request receives the app's standard auth behaviour (redirect/401 — match whatever `/` does today, verified by comparing responses).

### F2: Where-we-are pots `AUTO_VERIFY`
Section shows three bucket totals — Accessible now, Chris pension (Nov 2040), Abby pension (Aug 2043) — computed from the latest `finance.wealth_snapshots` data by account mapping in `lib/plan/constants.ts`. With no snapshot rows, falls back to plan baseline (£690k / £625k / £273k) with a "baseline" badge. Unit test covers grouping + fallback.

### F3: Spending run-rate `AUTO_VERIFY`
Trailing-12-month spend computed sign-aware (expenses only: amount < 0, category not income, not `exclude_from_totals`), excluding categories `Home improvement`, `Extension`, `Lego Out`, `Work Travel`. Displayed against the £69.5k plan line with delta. Unit test with fixture transactions asserts exact total and exclusions.

### F4: Pivot model + slider `AUTO_VERIFY`
ANI target slider (range £50,270–£80,000, step £250, default £59,500) drives a 9-year table (2026/27–2034/35) of: extra sacrifice, take-home cut, child benefit kept, net cost. Pure function in `lib/plan/pivot.ts`. Unit anchors (±£50 unless stated):
- target £60,000 → year-1 extra sacrifice £18,080; year-9 £30,138
- target £60,000 → year-1 CB kept £2,337 (full); cumulative 9-yr sacrifice £215,728 ±£500
- target £70,000 → year-1 CB kept ≈ 50% of full rate ±2%
- target £80,000+ → CB kept £0; extra sacrifice still computed (relief-only mode)
- relief rate 42% applied above £50,270 taxable, 28% below (taper handled at the boundary)

### F5: Retune recipe box `AUTO_VERIFY`
Shows the current UK tax year's numbers at the selected target: projected package, extra sacrifice, **AVC % to set** = ceil(extra sacrifice ÷ basic × 100). Unit anchor: 2026/27 at £59,500 target → 27%; at £60,000 → 26%.

### F6: Ladder rung sizing `AUTO_VERIFY`
Eleven target years 2035–2045 at £60,000 real each; 2043 auto-splits 50/50 across the 2042 and 2044 gilts. Per rung: face = target ÷ (dirty ÷ clean), est cost = face/100 × dirty. Pure function in `lib/plan/ladder.ts`. Unit anchor with fixture prices: dirty 156.06 / clean 81.15 → face £31,204 ±1%, cost £48,696 ±1%.

### F7: Rung purchase tracking `AUTO_VERIFY`
Each rung row toggles pending → bought (capturing EPIC, face, cost, date; editable) persisted in new table `finance.plan_ladder_rungs`. Survives reload. API route tested (GET/PUT); e2e: toggle, reload, still bought.

### F8: Live gilt prices API `AUTO_VERIFY`
`GET /api/plan/gilt-prices` returns `{ asOf, stale, gilts: [{epic, name, coupon, maturity, clean, dirty, realYield}] }` parsed from dividenddata.co.uk's index-linked gilt table, cached server-side ≥10 minutes (second call within window does not refetch — assert via mocked fetch call count). Parser unit-tested against a saved HTML fixture.

### F9: Portfolio split visual `AUTO_VERIFY`
Renders ladder / equities / cash / crypto split across accessible vs pension buckets, combining snapshot buckets with bought-rung totals. Unit test for the bucket maths; e2e asserts the visual and its total equals the pots total.

### F10: Outlook models `AUTO_VERIFY`
Retirement-year slider (2031–2035) + assumption inputs (real return 2%/4%, HB level, retirement spend) drive pure functions in `lib/plan/outlook.ts`: pots at exit, sustainable spend (annuitise to age 92 incl. levelised state pensions £12,548 each from Nov 2051 / Aug 2054), surplus at 92 via drawdown sim (UFPLS to fill both personal allowances from access dates Nov 2040 / Aug 2043 → tax-free cash → non-pension → taxed draws at 20% on the 75%). Unit anchors at baseline (retire Jun 2035, 2% real, £60k spend, HB £13k to Nov 2040):
- surplus at 92 = £2.0M ±5%
- sustainable spend = £95–100k
- retire 2032 → surplus ≈ £1.1M ±10% *(amended 2026-07-30: the sim compounds forgone wealth to 92; the doc chart's ~£1.7M used an uncompounded £100k/yr heuristic — sim is authoritative, doc chart flagged for correction)*
- retire 2032 → sustainable spend ≈ £80k ±3% *(this anchor unchanged — it was always computed properly)*

### F11: Drawdown detail anchors `AUTO_VERIFY`
*(amended 2026-07-30: the doc's "first tax 2073 / 3.3%" was computed under the pre-v7 HB profile; under adopted assumptions — £25k HB pre-2035, £13k to Nov 2040 — the sim's true result is ~0% tax with any first taxed pound ≥2070. Criteria now test the robust property the doc actually claims: "~3% or less out, tax deferred to the 2070s".)*
At baseline: effective tax on pension withdrawals ≤ 4%; first taxed withdrawal year ≥ 2070 or never; total drawdown tax ≤ £30k. Regression anchor with pots pinned to the doc's table (£747k/£648k/£820k): surplus at 92 = £2.04M ±3%, effective tax ≤ 1%. Unit tests.

### F12: Charts react `AUTO_VERIFY`
Early-retirement bar chart and phase-funding chart render; e2e moves the retirement slider and asserts a displayed surplus figure changes.

## Error handling criteria

### E1: Price source down `AUTO_VERIFY`
Source unreachable → API serves last cache with `stale: true` and `asOf`; ladder renders with a "prices as of…" notice. No cache at all → static fallback prices (constants captured 2026-07-29) with a warning. API test mocks fetch failure both ways.

### E2: Data layer down `AUTO_VERIFY`
Snapshot/transaction queries failing → page still returns 200; affected sections show baseline constants + an error notice; no unhandled error boundary. Test with mocked query failure.

### E3: Model edge inputs `AUTO_VERIFY`
Target ANI above current ANI → zero sacrifice, taper-only CB shown; slider boundary values (2031, 2035, £50,270, £80,000) produce finite numbers (no NaN/Infinity) — property-style unit test across the input grid.

## Performance criteria

### P1: Client-side recompute `AUTO_VERIFY`
Slider/toggle changes trigger no network requests (models are client-side pure TS) — e2e asserts zero fetches during slider interaction.

### P2: Render budget `AUTO_VERIFY`
`/plan` reaches visible content in < 3s against local dev with warm price cache (e2e timing, generous bound).

## Integration criteria

### I1: Migration checked in `AUTO_VERIFY`
`finance.plan_ladder_rungs` created by a migration file following the repo's existing migration pattern; API tests run against it.

### I2: Navigation `AUTO_VERIFY`
Sidebar gains a "Plan" entry linking to `/plan` (e2e).

### I3: Test suite `AUTO_VERIFY`
All new model functions under `lib/plan/` have unit tests in `tests/unit/plan/`; `npm test` passes; new unit tests number ≥ 20.

## UI criteria

### U1: Mobile usable `AUTO_VERIFY`
At 390px viewport: no horizontal body scroll; wide tables scroll inside their own containers (e2e assertion on scrollWidth).

### U2: Four sections present `AUTO_VERIFY`
Headings "Where we are", "The pivot", "The ladder", "The outlook" all present on `/plan` (e2e).

---

## Scope boundaries (NOT included)

- Editing payslip/plan constants through the UI (they live in `lib/plan/constants.ts`)
- Reading Abby's actual AVC contributions from any payroll source
- Any gilt dealing / II integration — the cockpit informs, never executes
- IHT/estate modelling (deferred by the plan itself)
- Reproducing the plan document's prose (link to the PDF instead)
- Real-time streaming prices; multi-user roles; CB claim workflow beyond a manual flag
- Monte-Carlo / stochastic modelling — all models are the plan's deterministic ones

## Notes for Build

- Models must be pure, dependency-free TS so unit anchors match the session models that produced the July plan (`plan/archive/2026-decision-scripts/` + `plan/runs/2026-07-30-amendment-1/`).
- Chart style: follow the plan doc's palette (#14467d, #3a6ea5, #2e9d5b, #c77c1b, #8a97a8) and direct labels.
- Gilt scraping logic already exists in `scripts/gilt-ladder.mjs` — port, don't rewrite.
