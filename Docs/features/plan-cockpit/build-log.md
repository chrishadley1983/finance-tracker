# Build Log — plan-cockpit

## Iteration 1 (2026-07-30) → CONVERGED

**Built:** `/plan` page (four sections) · `lib/plan/` pure models (constants, pivot, ladder, gilt-parser, outlook incl. 41-year drawdown sim, spend, buckets) · API routes `gilt-prices` (live scrape + 10-min cache + stale/fallback), `run-rate` (server-side 12-mo aggregation), `rungs` (upsert tracker) · migration 009 (`finance.plan_ladder_rungs`) · sidebar "Plan" entry · 48 new tests.

**Verification:** 1,388-test suite green · production build clean · live smoke: auth redirect matches `/`; live prices (32 gilts); run-rate from 2,276 real transactions; rungs degrade gracefully pre-migration.

**Model findings surfaced during build (material, reported to Chris):**
1. The July doc's early-retirement bar chart (£1.9/£1.8/£1.7/£1.6M) used an uncompounded £100k/yr heuristic. The rigorous sim gives ~£1.63M (2034), ~£1.38M (2033), ~£1.11M (2032), ~£0.85M (2031). Sustainable-spend figures (the decision-relevant ones) were always computed properly and stand. Criteria F10 amended; doc correction offered.
2. The doc's "3.3% exit tax / first taxed pound 2073" belongs to the pre-v7 HB profile. Under adopted assumptions (£25k HB pre-2035, £13k to Nov 2040) the sim pays essentially zero drawdown tax before 2075. Criteria F11 restated as robust properties.

**Fix cycle within the iteration:** DB types lacked the new table (hand-added pending regen) · AppLayout requires `title` · Map/matchAll iteration needed `Array.from` for the TS target · readonly-tuple `.includes` needed a `readonly string[]` type · port 3000 occupied by another app (smoke test on 3456).

**Human steps before merge:** apply migration 009 (no DB credentials on this machine); eyeball `/plan` once logged in.
