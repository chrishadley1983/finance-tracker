# Plan decisions log — 20 September 2026

Outcome of the pre-action audit of Amendment 1 (30 Jul 2026) and the Plan E ledger (3 Sep 2026).
Audit method: independent re-derivation of the AVC/HICBC tax maths and of the gilt-ladder and
drawdown model, plus reconciliation of the spend and income lines to the tracker.

## Decisions (Chris, 20 Sep 2026)

| Topic | Decision |
|---|---|
| Spend line | Plan on **£70k/yr** for now (tracker shows £77–80k on the cockpit definition; 2026 was a heavy holiday year). Address for 2027, or lift Chris-side income to match. Follow-up model: Chris at £20k take-home. |
| HB income | Keep working to close the gap (Micro 1 work, other HB extensions). Plan books £25k *take-home* (= ~£29.4k profit); 2026 is tracking ~£19k profit. |
| Ladder sizing | **Buy ~£98k of redemption per rung within the £909k** and treat coupons (~£7k/yr falling to ~£3k) as the top-up. Do NOT chase £108k redemptions (would need ~£569k in the ISA bridge, ~£50k more from Abby's Vanguard). Preference: keep more in equity / untied money. Re-price at live yields before ordering; retire the £60k defaults in the app/scripts before anyone prints an order sheet. |
| AVC start | Started on the **September 2026 payslip**, set from the August payslip (55% catch-up). Chris to send the September payslip at month end; recompute Oct–Mar and the January true-up. Child Benefit is being paid gross — the September start is what decides whether 2026/27's £2,337 is kept or clawed back. |
| Pay input | Rebased `PAYSLIP.basicAnnual` to £73,837.80 (Aug 2026). Outlook take-home and existing contributions now derived from the payslip, not hard-coded. |
| 2029 salary-sacrifice NIC cap | Noted (relief on excess over £2k falls 42% → 40%; Accenture may restructure). Address in 2029. |
| Tax-free cash / lifetime tax | Model over-counts TFC by ~£145k real (nominal-frozen LSA, no 25%-of-pot cap). "Lifetime tax ≈ £0" should read ~£44k (2% real). Survival unaffected. Not fixed in code. |
| £70k at 0% real | Fails ~2073 in the ledger model; accepted as an extreme stress case, not a forecast. |
| Assumptions confirmed | No death-in-service/redundancy cover assumed (external contingencies instead); bonus IS sacrificeable; full state pension for both; nominations to do; assume 57 on II; tax code 1117L double-tax (~£560/yr) to be squared up via self-assessment. |

## Still open

- Send September payslip → recompute AVC% for Oct–Mar (NMW floor now £26,510; a one-payslip slip breaches — fallback is bonus sacrifice).
- Beneficiary nominations on all four pots.
- Follow-up model: Chris £20k take-home vs £70k spend.

## Fixed later on 20 Sep 2026 (ladder shape)

- `scripts/ifa-e-yearly.mjs` now models real linkers: per-wrapper redemption sized by budget at the
  17–20 Sep 2026 curve (ISA rungs £98.7k/yr at 2.01% IRR; SIPP rungs £106.3k/yr at 2.29%), coupons
  paid out annually (~£6.8k/yr to 2035, reinvested in-wrapper) and the row-year off-by-one fixed
  (row 2026 = 1 Sep 2026 balances). Planning case now (after also rebasing the AVC array to the Aug payslip, £33.5k→£46.2k/yr incl. payroll): 2035 £2.28M, 2045 £2.20M, 2075 £2.21M;
  0%: £2.12M / £1.71M / £0.43M; 4%: £2.47M / £2.87M / £6.68M.
- `Docs/plan-e-ledger-2026-09-03.html` regenerated from it (tiles, rung table, year table, sensitivity,
  assumptions, to-do). The `.pdf` sibling is now STALE — re-export if it is shared.
- App: `LADDER.targetPerYearReal` (£60k) removed; `LADDER.budgetReal` 909.4k (+ ISA 519.5k / SIPP 389.9k)
  and `sizeByBudget()` in `lib/plan/ladder.ts`; `buildLadder()` defaults to budget sizing so the
  /plan cockpit shows ~£101.6k redemption per year at fallback prices. `scripts/gilt-ladder.mjs`
  defaults to `--budget 909400`, prints the coupon top-up row; `--amount` still forces a fixed size.
- Order sheets to use on the day: `node scripts/gilt-ladder.mjs --budget 519500 --years 2035-2040`
  and `node scripts/gilt-ladder.mjs --budget 389900 --years 2041-2045`.

## Second-pass fix, 20 Sep 2026 evening

- The architecture review found `ifa-e-yearly.mjs` still carried the April-basis AVC array (18.08→30.138) after the
  payslip rebase. Replaced with `pivotProgramme(60_000)` output on the Aug payslip (22.037→34.775, + £11.445k
  payroll) and the ledger regenerated again. This is exactly the drift class the single-source-of-truth work removes;
  until then the array MUST be kept equal to `lib/plan/pivot.ts`.
- The spend/reserve scenario runs earlier on 20 Sep (£60/70/80k × reserve intact/spent) were made before this fix;
  they understate Abby's DC by ~£45k at 2035 and will be re-run as part of the queued scenario modelling.
- Architecture plan for the drift-proof rebuild: `Docs/plan-single-source-of-truth-2026-09-20.md`.

## Phase 1 complete, 20 Sep 2026 (single home for planning numbers)

- `plan/assumptions.json` created: 70 entries, each FACT / CHECK / GUESS / DECISION with source, as-of and
  review-by dates, or DERIVED with a formula the loader recomputes (a hand-typed value is rejected).
  `spend.planLine` is recorded as the 20 Sep DECISION (£70,000; history keeps the June £69,500).
- Pots are now the 1 Sep 2026 per-account snapshots; the June `POTS_BASELINE` (chrisPension 624,954 /
  abbyPension 272,948 / nonPension 709,000, whose own comment summed to 690.5k) is retired. Consequence in
  the cockpit outlook at 2% real: pots at 2035 £2.29M (Chris £756k, Abby £705k), surplus at 92 £2.21M.
- `lib/plan/constants.ts` is a shim over the JSON; `scripts/ifa-e-yearly.mjs` and
  `scripts/abby-avc-calculator.mjs` read it too. `npm run plan:check` validates, reports freshness and
  cross-checks the ledger's AVC schedule and budgets against `lib/plan/pivot.ts`. Tests: 54 green,
  including a no-literal lint over `lib/plan` and `components/plan` (JSX prose £-figures allowed until phase 6).
- Ledger planning case from the JSON (2% real): 2035 £2.28M, 2045 £2.20M, 2075 £2.21M — unchanged from the
  20 Sep revision within rounding (budgets are now exact sums: ISA £519,516, SIPP £389,874).

## Phase 2 complete, 21 Sep 2026 (one engine)

- `plan/engine/` holds every calculation as pure, injected ES modules: `tax`, `pivot` (incl. the AVC recipe),
  `ladder` (incl. the price-table parser), `ledger`, `outlook`, `spend`; `index.mjs#runPlan(inputs)` is the single
  entry point and `run-standalone.mjs` runs it from a saved inputs file with nothing but Node.
- Before deleting `scripts/ifa-e-yearly.mjs` the engine ledger was compared with it at 0%, 2% and 4% real:
  every year's total identical to the 0.1k rounding, lifetime tax identical, AVC schedules identical.
  `scripts/abby-avc-calculator.mjs` → `plan/tools/avc.mjs` (reads `plan/observations/payslips/`);
  `scripts/gilt-ladder.mjs` → `plan/tools/order-sheet.mjs`.
- `lib/plan/{pivot,ladder,outlook,spend,buckets,gilt-parser}.ts` are now one-line bindings of the engine to
  `ASSUMPTIONS`; components and existing tests unchanged in behaviour.
- Golden hand-derivations seeded (`plan/derivations/golden.json`, 16 anchors, each with its working): payslip
  reconciliations, pivot year 1 / year 9 / nine-year total, take-home at the £60k line, HICBC steps, CB rate,
  TR40 rung, sizing-by-budget fixture, annuity factor, NMW floor, the Aug-2026 AVC recipe, the 2027 ledger row.
- New assumptions: `nmw.hourlyRate` 12.71 (FACT), `nmw.hoursPerWeek` 40 (GUESS), `nmw.annualFloor` DERIVED.
  Known limitation `ledger-avc-array-manual` closed (no second implementation remains).
- Tests: 76 green (assumptions, golden, engine, pivot, ladder, outlook, buckets, page).

## Phase 3 complete, 21 Sep 2026 (observations)

- `plan/inputs/` now holds the only code that reads the database or the price feed: `db.ts` (client),
  `adapters.ts` (snapshots, trailing-12m run-rate via the engine's `computeRunRate`, income by source,
  ladder rungs), `gilt-prices.mjs` (live dividenddata with file fallback, `--save` stores an observation),
  `payslips.mjs`, and `collect.ts#collectInputs()` which assembles the engine's inputs object and a drift
  report. The shaping is pure (`observe.mjs`) and tested with fixtures; the adapters are thin.
- `npm run plan:inputs` (live or `--offline`) writes `tmp/plan-inputs-<date>.json` — the file the phase-5 run
  job will archive as `runs/<date>/inputs.json` — and exits 1 on RED. `npm run plan:check --live` appends the
  same drift lines. `npm run plan:payslip add …` records a payslip from the PDF, validates it, prints the
  `plan:set` commands if the basic moved, and the AVC% recipe.
- New assumption `accounts.potsMap` (FACT): which `pots.*` key each snapshot account refreshes.
- First live run, 21 Sep 2026: all seven pots match the 1 Sep snapshots to the pound; payslip 24 days old;
  0 rungs bought; **trailing-12-month gross spend £91,167 vs the £70,000 plan line → RED** (this is the
  cockpit definition: gross debits, holidays included, home improvement/extension/LEGO/work travel excluded;
  net of holiday credits it is ≈£85k). Trailing-12m income: Abby £56.8k take-home incl. reimbursements,
  HB drawings £23.4k, Child Benefit £0.7k (claim only just reinstated), Cottrell £3.3k, side income £80,
  contributions £8.6k → recurring spendable ≈ £85.4k. The spend RED stands until holidays fall back or the
  plan line is re-decided; it is the household breakeven question from the 20 Sep review, now measured monthly.
- Today's live gilt prices saved as `plan/observations/gilt-prices/2026-09-21.json`.

## Phase 4 complete, 21 Sep 2026 (generated documents)

- `plan/render/render.mjs` renders seven documents from a run's outputs: `summary.html` (the one page for
  Abby: tiles, the AVC to set, the pivot table, how the plan holds up, the inputs check, the known
  limitations, what the numbers came from), `ledger.html` (Plan E account by account), `assumptions.md`
  (the register with provenance), `avc-recipe.md`, `ledger.csv`, `order-sheet-isa.csv`, `order-sheet-sipp.csv`.
  Self-contained HTML (system fonts, inline CSS, no scripts or external links).
- Rule 3 is now mechanical: every figure passes through `em.v(outputsPath, formattedText)`, which records
  it and tags it in HTML. `tests/unit/plan/render.test.ts` re-renders, re-formats each recorded path's
  value and checks the document text, reads the HTML spans back, greps the template source for digits,
  and checks every known limitation appears in every document. `fmt.mjs` is the only place a number is
  shaped. `npm run plan:render` writes the set to `tmp/plan-render-<date>/` with the inputs and outputs.
- The engine now also sizes the two wrappers on their own budgets (`ladder.isa`, `ladder.sipp`) so the
  order-sheet CSVs need no arithmetic in the renderer. Engine version `2026-09-21.phase4`.
- Tests: 90 green. The frozen 3 Sep/20 Sep ledger HTML stays frozen; from phase 5 the generated
  `ledger.html` in each run folder is the live document.

## Phase 5 complete, 21 Sep 2026 (the run job)

- `npm run plan:run` does the whole cycle: collect live inputs → engine → prove the standalone runner gives
  byte-identical output → diff against `plan/runs/LATEST_ACCEPTED` with `plan/inputs/diff-rules.json` →
  render the seven documents → write `plan/runs/<date>/` (inputs, outputs, diff.md, summary.json, documents,
  emissions, sha256 manifest with engine version and git sha) → notify → exit 1 on RED.
  `npm run plan:accept -- <date>` verifies the manifest, writes `ACCEPTED.json`, points `LATEST_ACCEPTED` at
  the run and prints the commit command; the folder is immutable from then on (`runs.test.ts` re-hashes it).
- Schedule: Task Scheduler `FinanceTracker-PlanRun-Quarterly`, 07:30 on 1 Jan / 1 Apr / 1 Jul / 1 Oct, next
  run 1 Oct 2026 (`scripts/run-plan-check.cmd` → `plan-run.log`). `scripts/run-bank-sync.cmd` now also runs
  `plan:check --live --notify` after every bank sync (weekly + 1st): drift vs fresh snapshots, payslip age,
  and a dead-man on the accepted run's age (AMBER 80 days, RED 100). `sync-truelayer.ts` untouched.
- Notifications: Discord when `DISCORD_WEBHOOK_PLAN` is set in `.env.local` (not yet set); email through the
  household SMTP config (Python smtplib) on RED or failure; a failed notification never fails the run.
- **First live run: `plan/runs/2026-09-21`** — RED: trailing-12-month gross spend £91,167 vs the £70,000
  plan line (+£21,167); everything else OK (pots exact to the 1 Sep snapshots, payslip 24 days old, AVC 55%,
  ISA rung £98.7k / SIPP £106.3k, 2035 £2.28M → 2075 £2.21M at 2% real). Not yet accepted: Chris reviews
  `diff.md` and `summary.html`, then `npm run plan:accept -- 2026-09-21`. Until a run is accepted every
  later run diffs against nothing and `plan:check` shows AMBER for the missing baseline.
- Tests: 97 green (adds `runs.test.ts`: diff rules with fixtures, manifest detect-any-change, immutability of
  accepted runs, offline end-to-end run → accept → second run GREEN).

## Phase 6 complete, 21 Sep 2026 (durability and housekeeping)

- `plan/triggers.md` maps every life event to the assumption keys it touches and what to run;
  `npm run plan:trigger -- <event>` prints the keys with current values and review dates. A test holds every
  trigger token in `assumptions.json` to a row in the document.
- `plan/HOW-TO-RERUN-2040.md`: how to read the accepted plan, re-run it from a run's `inputs.json` with nothing
  but a JavaScript runtime, update it, and rebuild it from `engine/SPEC.md` if JavaScript itself is gone.
- `lib/plan/constants.ts` retired → `lib/plan/assumptions.ts` (the app's binding to the JSON, no literals) which
  also exposes `LATEST_ACCEPTED` from `plan/runs/latest-accepted.json` (written by `plan:accept`). The `/plan`
  cockpit shows the accepted run, or that none exists yet. Its footer now computes the £-per-£ ratio and cites
  the payslip month instead of "April 2026".
- Migration `010_plan_rungs_comment.sql` corrects the rungs table comment (sized by budget); documentation only,
  apply with the next migration push. Done-criteria F4 anchors marked superseded by `plan/derivations`.
  Repo `CLAUDE.md` gained a "Household plan" section stating the four rules and the commands.

## 21 Sep 2026 — run-rate nets credits (decision, Chris)

The trailing-12-month spend used to count gross debits only. Chris: "The netting is required for when we make
group purchases and people pay us back. The gross spend is invalid." Refunds, reimbursements and contributions
are filed in the category they offset (the categorisation convention), so `computeRunRate` now subtracts credits
in spend categories (and in excluded categories for the excluded total) and reports `grossSpend` and
`creditsNetted` alongside. Effect on the window to 21 Sep 2026: gross £91,167 → **net £84,157** (credits £7,010,
mostly the Cottrell and parental holiday contributions and the Lalandia refund); still RED against the £70k line
(+£14,157). Engine version `2026-09-21.net-runrate`; the accepted run 2026-09-21 carries the gross figure in its
inputs and is left as it is (immutable); the next run diffs against it.

## Phase 7 complete, 21 Sep 2026 (scenarios, exports, the 2029 NIC cap)

- The ledger engine took the knobs the queued questions needed without changing the accepted numbers (a
  regression test reproduces run 2026-09-21 exactly): a spend schedule, a per-year return path, a pre-retirement
  cash-flow line (take-home + child benefit + Cottrell + side income + HB − spend, shortfalls drawn from the
  reserve in order cash → crypto → Abby ISA → new ISA → GIA), and a third wrapper for extension rungs.
- `engine/scenarios.mjs` runs the named set at 0% / 2% / 4% real, the spend × return grid, and the Shiller replay.
  Results at the 21 Sep 2026 yields (£ today's money; "end" = 2075):

  | Scenario | 2035 @2% | End @2% | End @0% | Cash out @0% |
  |---|---|---|---|---|
  | Planning case, £60k for life | £2.28M | £2.21M | £0.43M | – |
  | £70k for life | £2.27M | £1.49M | −£0.05M | 2073 |
  | £80k for life | £2.26M | £0.72M | −£0.47M | 2066 |
  | £80k to 2040, then £65k | £2.26M | £1.67M | £0.08M | – |
  | Reserve (cash + crypto) spent by 2035 | £2.15M | £1.99M | £0.28M | – |
  | Chris £20k take-home, spend £70k to 2035 | £2.25M | £2.17M | £0.38M | – (reserve draw £35k) |
  | Chris £20k take-home, spend £80k to 2035 | £2.17M | £2.02M | £0.29M | – (reserve draw £115k) |
  | Ratchet: Accenture pot (£193k) → 2046–50 rungs | £2.29M | £2.25M | £0.55M | – (rung £54.0k, IRR 2.37%) |

  Reading: the plan only breaks at a permanently flat real market *and* £70k+ for life, and even then not until
  the 2060s–70s; every other case ends above zero at 0% real. Chris at £20k take-home to 2035 costs the reserve
  £35k (at £70k spend) or £115k (at £80k) and moves the 2075 figure by under 2% at 2% real. The step-down profile
  is nearly as robust as £60k flat. Replay over 1,274 full 49-year starts since 1871: no start ran out of cash;
  median end £22M, 5th percentile £10.6M, worst £7.0M (real US equity returns are far above the 2% planning
  case; the planning case is deliberately conservative). Only 14 full-length starts have CAPE ≥ 25 (1901,
  1928–30), all finished above £13M — a thin sample, shown as such.
- The salary-sacrifice NIC cap (Autumn Budget 2025: sacrifice above £2,000 a year NI-able from 2029/30) is now
  modelled in the AVC relief and take-home: from 2029/30 the extra sacrifice costs Abby 60% of take-home rather than
  58% (2% employee NI above the UEL no longer saved). Known limitation `nic-cap-2029` closed. The AVC % recipe
  is unchanged (it targets the £60k line, not the relief).
- Exports: every run folder now has `plan.xlsx` (Summary, Ledger, Pivot, Ladder ISA/SIPP, Scenarios, Grid, Replay,
  Assumptions, Limitations) and `summary.pdf`. Edge's launcher process returns exit 0 before the PDF exists, so
  `render/pdf.mjs` polls for the file; `plan-run.ts` and `plan-check.ts` set `process.exitCode` instead of calling
  `process.exit()` (a libuv assertion on Windows when exiting mid-fetch). `--no-notify` and `--no-pdf` flags for
  tests.
- Engine version `2026-09-21.phase7`; yields observation `gilt-yields/2026-09-21.json` (with 2046–50 `ext` rungs)
  supersedes 2026-09-20 for new runs, so rung figures move slightly against the accepted run. Tests: 111 green.
