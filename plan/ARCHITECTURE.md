# Making the 50-year household plan drift-proof — implementation plan

**Prepared:** 20 September 2026 · **Status:** proposal, not started · **Origin:** the 20 Sep audit of Amendment 1 (30 Jul) and the Plan E ledger (3 Sep) found six material discrepancies in a seven-week-old plan, all caused by the same numbers living in several places that are edited independently. The same evening a second instance surfaced: the ledger model's AVC array was still on the April payslip after the pivot code had been rebased to August.

## 1. Where planning numbers live today

| Home | What it holds | Status |
|---|---|---|
| `lib/plan/constants.ts` | PAYSLIP, TAX, HICBC, CHILD_BENEFIT, POTS_BASELINE, ACCOUNT_BUCKETS, SPEND (planLine 69_500), INCOME, DATES, STATE_PENSION, DRAWDOWN, LADDER, FALLBACK_GILT_PRICES | Tracked. Module-level imports: the engine cannot run against a different assumption set without editing source. |
| `lib/plan/outlook.ts` | `DEFAULT_OUTLOOK.aniTarget: 60_000` vs `HICBC.defaultTarget: 59_500` in the cockpit; `year <= 2045` literal | Two ANI targets in one app. |
| `components/plan/*.tsx` | UI defaults 60_000, 13_000, cash buffer 55_000, slider min 50_270; footer "Payslip constants from April 2026" (now false) | Hand-typed. |
| `scripts/abby-avc-calculator.mjs` (untracked) | Payslip YTD observation, NMW floor, net-cost rate | The only home of the payslip observation. |
| `scripts/gilt-ladder.mjs` | Own copy of the dividenddata parser and allocator | Duplicate of `lib/plan/ladder.ts` + `gilt-parser.ts`. |
| `scripts/ifa-e-yearly.mjs` (untracked) | PA, BASIC, TFC, SPEND, HB, AVC array, rung yields, opening balances | Generates the numbers pasted into the ledger HTML. AVC array drifted from `pivot.ts` on 20 Sep. |
| ~15 other `scripts/ifa-*.mjs` (untracked) | Each re-declares IRR 0.0193, PA, BASIC, TFC_CAP, SPEND, HB, the AVC array, X=107.8, pots | Decision-time comparisons; historical evidence, not live models. |
| Ad-hoc DB pulls (`ifa-context-dump*`, `ifa-income-audit`, `monthly-spend-incomes`, `spend-2025-ex-kitchen`, …) | Own income/expense classification each | `ifa-context-dump.mjs` orders `wealth_snapshots` by `snapshot_date`; the column is `date`, so that section silently errored. |
| `Docs/*.md/.html/.pdf` | All prose numbers (£69.5k, £108k + £8k, "42% throughout FACT", …) | **All untracked.** No generator; numbers pasted from script stdout. Ledger HTML loads Google Fonts (not self-contained). |
| `Docs/features/plan-cockpit/done-criteria.md`, migration 009 comment | F4/F5 anchors £18,080 / 27%; "Target: £60k real per year" | Stale. |
| DB: `finance.wealth_snapshots`, `plan_ladder_rungs`, `transactions` + `categories` | Live pots, purchases, spend (`computeRunRate`) | Only the cockpit uses `computeRunRate`; docs quoted a different "measured" spend. |
| `tests/unit/plan/*.test.ts` | Anchors copied from the doc or the model's own output | Internal consistency only. |
| `lib/fire/ern/uk-tax.ts` | A second PA 12_570 / LSA 268_275 | Third copy of tax constants. |

Production today: no doc generator (the monthly report pipeline in `lib/reports/` is the nearest precedent). Scheduling: `scripts/run-bank-sync.cmd` → Task Scheduler → `npm run sync:bank` with post-steps. Tests: vitest, `@/*` alias, `allowJs: true` (plain `.mjs` importable by Next and vitest).

## 2. Target architecture

```
plan/
  README.md                       1-page map + the four rules below
  HOW-TO-RERUN-2040.md            durability path (§6)
  assumptions.json                THE home for chosen/quoted numbers
  assumptions.schema.json         validated by loader + test
  decisions.md                    append-only decision log (anchored headings)
  triggers.md                     life-event → keys to touch (§8)
  observations/payslips/YYYY-MM.json, observations/gilt-prices/YYYY-MM-DD.json, observations/rungs/
  engine/                         PURE plain ES modules, // @ts-check, no imports outside engine/, no Node APIs
    index.mjs  runPlan(inputs) -> outputs      the only entry point
    tax.mjs pivot.mjs ladder.mjs ledger.mjs outlook.mjs spend.mjs buckets.mjs gilt-parser.mjs scenarios.mjs
    SPEC.md                        every formula in prose (spreadsheet re-implementable)
    run-standalone.mjs             node plan/engine/run-standalone.mjs inputs.json > outputs.json
  inputs/                         the only code that touches the DB: assumptions.mjs (load/validate/DERIVED/freshness),
                                  snapshots.ts run-rate.ts income.ts rungs.ts gilt-prices.ts payslips.mjs
  render/                         outputs.json -> documents; NO arithmetic, NO numeric literals
    summary.html.mjs ledger.html.mjs assumptions.md.mjs order-sheet.csv.mjs avc-recipe.md.mjs ledger.csv.mjs fmt.mjs
  derivations/golden.json + one .md per anchor (independent hand workings)
  tools/avc.mjs order-sheet.mjs set.mjs        operating tools; import engine, read assumptions + observations
  runs/<date>/ inputs.json outputs.json diff.md summary.html ledger.html *.csv manifest.json ACCEPTED.json
  runs/LATEST_ACCEPTED            one line
  runs/2026-06-09-june-plan/, 2026-07-30-amendment-1/, 2026-09-03-plan-e-ledger/   FROZEN historical + FROZEN.md
  archive/2026-decision-scripts/  the ifa-* comparison scripts, frozen, README "evidence, not maintained"
scripts/plan-run.ts plan-accept.ts plan-check.ts run-plan-check.cmd register-plan-check-task.ps1
lib/plan/                         shrinks to thin re-exports of plan/engine + loader of plan/assumptions.json
```

**Four rules (enforced by tests):**
1. **Engine is pure and injected.** Every function takes `(inputs, …)`; no module-level constant imports. `runPlan(inputs)` is deterministic: same `inputs.json` → byte-identical `outputs.json` forever.
2. **Three kinds of number, three homes.** Assumptions (chosen/quoted → `assumptions.json`), observations (measured → `observations/` or captured into the run's `inputs.json`), outputs (computed → `outputs.json`). Nothing else may contain a planning literal.
3. **Renderers do no arithmetic and contain no numeric literals.** Every number is emitted through `<span data-key="ladder.isa.redemptionPerYear">£98.7k</span>` (or `{{key}}` in Markdown). Prose may not state a magnitude in words except via a computed phrase.
4. **Accepted runs are immutable.** Hash manifest verified by a test; git history is the audit trail.

### `assumptions.json` (flat dotted keys)

```json
{
  "schemaVersion": 1,
  "entries": {
    "payslip.basicAnnual": { "value": 73837.80, "unit": "GBP/yr nominal", "status": "FACT",
      "source": "Abby payslip Aug 2026 (tax month 05): £6,153.15/mo", "asOf": "2026-08-31",
      "reviewBy": "2026-10-07", "cadence": "monthly", "triggers": ["payslip", "job-change"],
      "history": [{ "value": 69900, "asOf": "2026-04-30", "supersededOn": "2026-09-20", "why": "pay rise landed" }] },
    "tax.personalAllowance": { "value": 12570, "status": "FACT", "source": "gov.uk; frozen to Apr 2031", "asOf": "2026-04-06", "reviewBy": "2027-04-06", "cadence": "tax-year", "triggers": ["april", "budget"] },
    "spend.planLine": { "value": 70000, "status": "DECISION", "source": "decisions.md#2026-09-20-spend", "asOf": "2026-09-20", "reviewBy": "2027-01-31" },
    "hicbc.operatingTarget": { "value": 59500, "status": "DECISION", "source": "decisions.md#2026-07-30-target" },
    "returns.realEquity.planning": { "value": 0.02, "status": "GUESS", "reviewBy": "2027-09-01", "cadence": "annual" },
    "ladder.budgetReal": { "status": "DERIVED", "formula": "sum(pots.chrisIiIsa, pots.abbyIiIsa, pots.chrisIiSipp)" },
    "pivot.reliefAboveFloor": { "value": 0.42, "status": "FACT", "reviewBy": "2029-04-06",
      "note": "Breaks Apr 2029: NIC relief on salary sacrifice above £2k/yr removed → 0.40 on the excess; model must branch by tax year." }
  },
  "knownLimitations": [
    { "id": "tfc-nominal-cap", "text": "TFC modelled as a cumulative real allowance, not 25%-per-crystallisation nor nominal-frozen LSA; over-counts ~£145k real. Lifetime tax ≈ £44k not £0.", "raised": "2026-09-20", "fixBy": "2027-06-01" }
  ]
}
```

Status enum: `FACT`, `CHECK`, `GUESS`, `DECISION` (must link a `decisions.md` anchor), `DERIVED` (formula only; hand-typed value forbidden — this kills the 53_988 / 10_834 / 909_400 / 43_500 class of drift). `knownLimitations` is printed into every rendered document.

Payslip observation: `{ taxYear, taxMonth, payDate, basicMonthly, taxablePayMonthly, ytdTaxable, ytdTax, ytdNi, netMonthly, avcPct, employerPension, notes }` — input to the AVC tool and provenance for `payslip.basicAnnual` (loader asserts `basicAnnual == latest basicMonthly × 12`).

## 3. Migration path

| Today | Action |
|---|---|
| `lib/plan/constants.ts` | Values → `assumptions.json`; FALLBACK_GILT_PRICES → `observations/gilt-prices/2026-07-29.json`; ACCOUNT_BUCKETS → `accounts.bucketMap`; PALETTE → `render/fmt.mjs`. Shim for one phase, then delete. |
| `lib/plan/{pivot,ladder,outlook,spend,buckets,gilt-parser}.ts` | Port to `plan/engine/*.mjs` with injection; `lib/plan/*.ts` become 1-line re-exports, then components import the engine. |
| `scripts/abby-avc-calculator.mjs` | Logic → `engine/pivot.mjs#avcRecipeFromYtd`; CLI → `tools/avc.mjs`; payslip fields → `observations/payslips/`. Delete. |
| `scripts/gilt-ladder.mjs` | Delete duplicate; `tools/order-sheet.mjs` = gilt-prices adapter + `engine/ladder.mjs` + CSV. `couponSchedule` also feeds the ledger. |
| `scripts/ifa-e-yearly.mjs` | Fold → `engine/ledger.mjs`; AVC array ← `pivotProgramme`; rung yields ← gilt-prices observation; opening balances ← snapshots; SPEND/HB/PA/BASIC/TFC ← assumptions. Keep `--json` shape as `outputs.ledger`. |
| `ifa-e-tax.mjs` | Superseded; archive. `ifa-outcome-grid.mjs` variant-E path → `engine/scenarios.mjs` (phase 7). All other `ifa-*` → `archive/2026-decision-scripts/`. |
| Ad-hoc DB scripts | Replace with `plan/inputs/*` reusing `lib/reports/classify.ts` and `computeRunRate`. Delete. |
| `Docs/investment-plan-*`, `Docs/plan-e-ledger-*` | Freeze into `plan/runs/<date>-…/` with `FROZEN.md` listing the audit findings. Not regenerated. Ledger template → `render/ledger.html.mjs` (system/embedded fonts, inline SVG). |
| `Docs/plan-decisions-2026-09-20.md` | → `plan/decisions.md`, append-only. |
| Test anchors | → `derivations/golden.json` + derivation files; structural tests stay. |
| Migration 009 comment, done-criteria F4–F6, PivotSection footer, component literals, `lib/fire/ern/uk-tax.ts` | Fix in phase 6; add a test that `uk-tax.ts` PA/LSA equal `assumptions.json`. |
| `app/plan/page.tsx` | Add an "Accepted plan" strip reading `runs/LATEST_ACCEPTED/outputs.json` beside the live numbers. |

## 4. The re-run job

`npm run plan:run` (`scripts/plan-run.ts`): load + validate assumptions (recompute DERIVED, fail on mismatch, freshness report) → collect observations (latest balance per account, trailing-12m `computeRunRate`, income by source, rungs, live gilt prices with flagged fallback, newest payslip) → write `inputs.json` → `runPlan` → `outputs.json`, and run `run-standalone.mjs` as a second process asserting byte-equality → diff vs `LATEST_ACCEPTED` → render → `manifest.json` (sha256, engine git sha, node version) → notify (Discord webhook; email `summary.html` via the existing SMTP config on failure/RED) → exit non-zero on RED.

`npm run plan:accept <run> --note "…"` verifies hashes, writes `ACCEPTED.json`, updates `LATEST_ACCEPTED`; the commit is Chris's action.

**Triggers:** quarterly Task Scheduler (1 Jan/Apr/Jul/Oct 07:30, `run-plan-check.cmd`, S4U registration script as in the sibling repo); post-step in `sync-truelayer.ts` runs `plan:run --check-only` when the newest snapshot date or the payslip folder hash differs from `LATEST_ACCEPTED`; dead-man alert if `LATEST_ACCEPTED` > 100 days; all `cadence: tax-year` entries go AMBER from 1 March.

**Diff rules** (`plan/inputs/diff-rules.json`):

| Item | AMBER | RED |
|---|---|---|
| Any assumption changed since accepted | listed | — |
| Assumption past `reviewBy` | ≤ 90 days | > 90 days |
| DERIVED mismatch / schema error | — | fail run |
| Pot bucket (accessible / Chris / Abby) | ±3% or ±£15k | ±10% |
| Trailing-12m run-rate vs `spend.planLine` | over by > £2k | over by > £8k |
| Newest payslip age | > 45 days | > 75 days |
| AVC% recipe | — | any change; landed ANI > target; NMW breach |
| Ladder redemption per rung | ±2% | ±5%; cost vs budget > 0.5% |
| Ledger totals 2035 / 2045 / 2075 | ±2% | ±5% or a depletion year appears |
| Sustainable spend | ±£1k | ±£3k |
| Gilt price source | fallback used | fallback > 30 days old |

## 5. Test strategy

1. **Golden hand-derivations** iterated from `derivations/golden.json`; each `expected` produced outside the engine (hand, HMRC PAYE calculator, two-line spreadsheet) with its working filed. Seed: Aug-2026 net pay £4,511.60; 2026/27 AVC% from the Aug YTD; CB at £70k = 50%; TR40 face £31,204 / cost £48,696; `sizeByBudget` on a two-gilt fixture longhand; `a(40, 0.02)`; ledger 2027 row longhand; UFPLS 4/3 PA-fill; NMW floor 40 × 12.71 × 52.14; HICBC step at £60,200. A golden may only change with a new derivation file and a decisions line.
2. **Doc == model**: render `outputs.json`, parse every `data-key` back and assert `fmt(outputs[key]) === text`; lint templates, `components/plan/**` and `plan/engine/**` for numeric literals outside data-key emission.
3. **No second home**: `uk-tax.ts` equals assumptions; `plan_ladder_rungs` years ⊆ ladder range (skipped if DB unreachable).
4. **Input freshness**: soft vitest failure only > 90 days past `reviewBy` or payslip > 75 days; the operational nag lives in `plan:check`.
5. **Immutability**: re-hash every accepted run against its manifest.
6. **Determinism / standalone**: `runPlan` twice deep-equal; standalone equals in-process.
7. **Engine invariants** (keep/extend): monotone surplus vs retire year, 4% ≥ 2%, finite grid, ladder cost = budget ±0.5%, 2043 split, ledger 2026 row equals observations exactly.
8. **Migration-only cross-checks** (deleted after phase 2): `engine/ledger.mjs` vs `ifa-e-yearly.mjs --json` on identical inputs within 0.5%.

## 6. Durability (2040-Chris, Next.js dead)

Everything lives in git under `plan/` as JSON/Markdown/CSV/self-contained HTML (system or embedded fonts, inline SVG). PDFs only for accepted runs (headless Edge or Playwright); if the repo passes ~100 MB, PDFs move to OneDrive with sha256 in the manifest. The engine is plain ES modules with no external imports and no Node APIs: `node plan/engine/run-standalone.mjs inputs.json` runs on any ES2020 runtime or a browser module script; `SPEC.md` states every formula so it can be re-implemented in a spreadsheet. Accepted runs embed their observations, so re-rendering a 2026 run in 2040 needs no database or secrets. `HOW-TO-RERUN-2040.md`: clone/unzip → any JS runtime → run standalone on the latest accepted inputs → open `summary.html` → to update, edit `assumptions.json` with `tools/set.mjs`, add a payslip JSON, re-run. Yearly: zip `plan/` off-git. Phase 0 fixes the most immediate hole: the plan documents and models are untracked today.

## 7. Phases

| # | Phase | Effort | De-risks |
|---|---|---|---|
| 0 ✅ 20 Sep | Commit everything untracked (Docs plan files, ifa scripts, AVC calculator) under `plan/runs/*-FROZEN` and `plan/archive/`; tag `plan-pre-refactor-2026-09-20`. | 2 h | Loss of the evidence base; a diffable baseline. |
| 1 ✅ 20 Sep | `assumptions.json` + schema + loader (DERIVED enforcement, freshness) + `plan:check` + `tools/set.mjs`; `constants.ts` becomes a shim; `spend.planLine: 70000` as DECISION; no-literal lint tests. Also done: the ledger model and AVC calculator read the JSON; pots rebased to the 1 Sep 2026 snapshots (June `POTS_BASELINE` retired); fallback gilt prices moved to `observations/`. | 6–8 h | One home with provenance; catches 69.5k-vs-70k and the April footer today. |
| 2 ✅ 21 Sep | Extract `plan/engine/*.mjs` with injection; port `ifa-e-yearly` → `ledger.mjs` fed by `pivotProgramme`; `run-standalone.mjs`; components import the engine; seed `golden.json`; migration cross-check test. Done: engine reproduced the old ledger to 0.0000% across all years and return cases before the script was deleted; `lib/plan/*.ts` are bindings; tools `ledger`/`avc`/`order-sheet` replace the three scripts; 16 goldens with derivation notes; `SPEC.md`; payslip observations Apr/Aug 2026. | 8–10 h | The live AVC-array drift; cockpit vs script disagreement; determinism. |
| 3 ✅ 21 Sep | Observation adapters; payslip JSONs Apr/Aug/Sep 2026; `tools/avc.mjs`, `tools/order-sheet.mjs`; delete ad-hoc DB scripts. Done: `inputs/{db,adapters,collect}.ts` + `observe.mjs` (pure shaping, tested with fixtures) + `gilt-prices.mjs`/`payslips.mjs`; `plan:inputs` writes the engine's inputs file and prints the drift report; `plan:check --live`; `plan:payslip add`; first live run: pots match the 1 Sep snapshots exactly, trailing-12m gross spend £91.2k vs the £70k line (RED, as the audit found). | 4–6 h | "Measured" spend ≠ tracker; the `snapshot_date` bug class. |
| 4 ✅ 21 Sep | Renderers with data-key discipline; doc==model tests; self-contained HTML; `knownLimitations` block in every doc. Done: `render/render.mjs` (summary.html, ledger.html, assumptions.md, avc-recipe.md, ledger.csv, order-sheet-isa/sipp.csv) + `fmt.mjs`; every number passes through `em.v(key, text)` and is recorded; `render.test.ts` re-formats each recorded path and checks the text, reads the HTML spans back, lints the template for digits, checks self-containment and that every limitation appears; `npm run plan:render`. | 8–10 h | Nothing hand-typed; the "£108k + £8k" and "42% FACT" class. |
| 5 ✅ 21 Sep | `plan:run` / diff / `plan:accept` / manifest + immutability test; Task Scheduler `.cmd` + `.ps1`; Discord + email; bank-sync hook + dead-man. Done: `scripts/plan-run.ts` (collect → run → standalone proof → diff vs LATEST_ACCEPTED → render → `plan/runs/<date>/` + manifest → notify, exit 1 on RED), `plan-accept.ts` (verify manifest, ACCEPTED.json, LATEST_ACCEPTED), `inputs/{diff,manifest,notify}.mjs` + `diff-rules.json`; task `FinanceTracker-PlanRun-Quarterly` (07:30 on 1 Jan/Apr/Jul/Oct); `run-bank-sync.cmd` now also runs `plan:check --live --notify` (dead-man on the accepted run's age); Discord via `DISCORD_WEBHOOK_PLAN` when set, email via the household SMTP config on RED/failure; `runs.test.ts` (rules, manifest, immutability of accepted runs, offline end-to-end run + accept). First live run `plan/runs/2026-09-21` written, RED on the spend line, awaiting acceptance. | 6–8 h | Scheduled self-policing; immutable archive. |
| 6 ✅ 21 Sep | `triggers.md` + `plan:trigger <event>`; `HOW-TO-RERUN-2040.md`; `SPEC.md`; retire `constants.ts`; migration 010 comment; done-criteria supersession; CLAUDE.md; `/plan` accepted-run strip. Done: `lib/plan/constants.ts` → `lib/plan/assumptions.ts` (same bindings, plus `LATEST_ACCEPTED` from `plan/runs/latest-accepted.json` written by `plan:accept`); cockpit shows the accepted run (or "none yet"); PivotSection footer computes its ratio and cites the payslip month; `triggers.test.ts` holds every trigger token to a row in `triggers.md`; migration `010_plan_rungs_comment.sql` (documentation only, apply with the next push); repo `CLAUDE.md` section. | 3–4 h | Durability; agent/tooling confusion. |
| 7 (optional) | `engine/scenarios.mjs` (flat grid + CAPE replay); PDF export; xlsx export; 2029 NIC branch in `tax.mjs`; step-down spend profiles. | 4–6 h | Ledger §4 completeness; the 2029 known break; the queued scenario modelling. |

Total ≈ 40–50 h. Phases 0–2 remove the active drift; 3–5 make it self-policing.

## 8. Life-event triggers

| Event | Keys / files | Then |
|---|---|---|
| New payslip (monthly) | `observations/payslips/YYYY-MM.json` | `plan:run --check-only`; AVC% RED → act |
| Job change / pay rise / bonus confirmed | `payslip.*`, `pivot.bonusSacrificeable`, DERIVED take-home, `dates.*` | full run + accept |
| 6 April / Budget | all `cadence: tax-year` (PA, bands, NI, HICBC, CB, NMW, state pension, LSA); `pivot.reliefAboveFloor` from 2029 | full run + accept |
| Wealth snapshot (monthly) | nothing to type; check `accounts.bucketMap` if an account is new | automatic check |
| Rung bought | `plan_ladder_rungs` via cockpit; optional contract-note ref | full run (ladder cost vs budget) |
| Gilt yields move > 0.25% | nothing to type; order sheet re-prices live | `tools/order-sheet.mjs` before any order |
| HB profit trend | `income.hbPreRetirement` (DECISION) if 12-m adapter > 20% off two quarters running | decision entry + run |
| Kid milestones (Emmie Aug 2035, Max Aug 2037; FTE changes) | `childBenefit.*EndsAug`, `dates.planRetirementYear` | run |
| Death / redundancy / illness | `overrides/*.json` scenario file, never the base | scenario run, tagged, not accepted |
| Annual | zip `plan/` off-git; review GUESS entries; re-derive one golden by hand | — |

## 9. Risks and trade-offs

- **Over-engineering for two people.** The engine is ~700 lines of plain JS; the run job is one script; new infrastructure is a JSON file, a Task Scheduler entry and a webhook. Skip phase 7 unless wanted. What matters most is rules 2 and 3, enforced by two cheap lint tests.
- **JSON hand-editing errors.** `tools/set.mjs` + schema + DERIVED recomputation; flat keys diff readably.
- **UI churn.** Phase 2 keeps `lib/plan/*` as re-exports.
- **Consistency is not correctness.** The framework guarantees every document equals the model; only golden derivations and the audit habit guarantee the model is right. Hence goldens are produced outside the engine, and `knownLimitations` travel with every document.
- **Prose that encodes numbers in words.** Renderers compute such phrases or drop them; add to the `plan:accept` review checklist.
- **Time-based tests.** Soft, 90-day grace; operational nag in `plan:check`.
- **Notification rot.** Dead-man in bank-sync post-steps; `diff.md` always on disk.
- **Personal data in git.** Payslip JSON is Abby's pay data in a private repo. Decide: keep (matches the docs already holding the figures) or store only annualised figures in `assumptions.json` with monthly files off-git.
- **Repo growth.** PDFs only for accepted runs, or off-git with hashes.
- **Spouse usability.** Abby's touchpoints are `summary.html` (emailed on accept) and the AVC% line; she never opens JSON. Label accepted-run values so "the plan" has one dated answer.

### Critical files
- `lib/plan/constants.ts` — values and the module-level-import pattern to invert
- `scripts/ifa-e-yearly.mjs` — Plan E model to fold into `plan/engine/ledger.mjs`
- `lib/plan/pivot.ts`, `lib/plan/ladder.ts` — engine cores to port (absorbing `abby-avc-calculator.mjs` and `gilt-ladder.mjs`)
- `scripts/sync-truelayer.ts`, `scripts/run-bank-sync.cmd` — scheduled-job pattern to mirror and hook into
- `Docs/plan-e-ledger-2026-09-03.html` — design that becomes `plan/render/ledger.html.mjs`

## Decisions taken (Chris, 20 Sep 2026)

- **Payslip observations:** monthly JSON files live in the private repo under `plan/observations/payslips/`.
- **Accepted-run PDFs:** committed to the private repo alongside each run (revisit only if the repo passes ~100 MB).
- **Phase 7 is in scope from the start:** scenarios engine (flat grid + CAPE replay), PDF/xlsx export, the 2029 NIC branch, and the queued scenario set — step-down spend (~£80k to ~2040 then ~£65k), Chris £20k take-home pre-2035, the reserve-spent case, and buying the 2046–2050 rungs from the SIPP as a ratchet-forward option.
- **Not yet approved to build.** This is the design; implementation starts on a branch when Chris says go, phase 0 first.
