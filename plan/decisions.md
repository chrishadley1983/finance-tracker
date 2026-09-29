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

## 21 Sep 2026 — run 2026-09-21-phase7 accepted (decision, Chris)

Baseline is now `plan/runs/2026-09-21-phase7` (supersedes 2026-09-21). Chris: "I want it accepted at 70k and we
will work to curb spending to meet it" — the £70k plan line stands; the RED on the trailing-12-month spend
(£84,157 net) is acknowledged as the target to close, not a reason to move the line.

## 3 Sep 2026 decision, recorded 21 Sep — Chris's Accenture pension stays at L&G

Not previously in this log (it was only in the 3 Sep Plan E ledger notes). The June plan's action "transfer Chris's
Accenture DC to the ii SIPP" was retired on 3 Sep: the pot stays at L&G and was switched that day from the Drawdown
Focus lifestyle fund to 100% Global Equity Tracker (B6W3, 0.11%). Chris, 21 Sep: not worth the effort given the
fund now available. It is part of the growth sleeve in the baseline. The phase 7 "ratchet to 2050" scenario remains
an option only; choosing it would need a transfer at that time, because L&G cannot hold individual gilts.

## 21 Sep 2026 — execution.html: the ladder purchase checklist, rendered like everything else

Chris asked for an actionable document of the ladder execution steps. Rather than hand-write one, every run now
renders `execution.html` from the outputs: which account opens (Abby's ii ISA), the partial Vanguard transfer,
and a tick-box purchase table per account — Chris's ii ISA (near rungs), Chris's ii SIPP (far rungs), Abby's ii
ISA (middle rungs) — with nominal to order, cost at the run's prices, real redemption and coverage notes. The
ISA split between the two holders is computed in the engine (`ladder.splitByHolder`: Chris's pot buys in
maturity order until it runs out, the straddling gilt is split pro rata, the rest is Abby's); engine version
`2026-09-21.phase7b`. At 21 Sep prices: Chris's ISA buys 2035–37 plus a slice of 2038, Abby's the rest of 2038
plus 2039–40. Emailed to Chris with the two order-sheet CSVs; the accepted run (2026-09-21-phase7) predates
the document and is left immutable — the next run carries it. Also fixed: the email helper read stdin through
the console codec, which broke on characters outside cp1252 (the tick boxes).

## 23 Sep 2026 — critical review of Plan E; engine in today's money; drawing to the basic-rate band (decisions, Chris)

A from-scratch review (independent model, Monte Carlo, US history with haircuts, variant and retirement-date
comparisons) found Plan E the right design for the stated goal: on every downside test E sustains £3–4k/yr more
than the June £498k ladder and £6–15k/yr more than all-equity; the SIPP rungs are worth £3–7k/yr; the £1.18M
"max floor" adds only £1–2k/yr for ~£0.5M less median upside. Each year retirement moves shifts downside-safe spend
by ~£2k/yr for life. It also found three errors, all flattering, and an estate problem. Chris decided:

- **Fix the three errors (done, engine `2026-09-23.real-terms`).** (1) Abby's AVC schedule was added in cash to a
  real ledger — now deflated by the new `returns.cpi` (2%). (2) Tax-free cash treated the £268,275 allowance as real
  and uncapped — now frozen in cash and limited to 25% of what is crystallised. (3) The personal allowance and
  higher-rate threshold were held real — now frozen in cash to 2030/31 (`tax.thresholdsFrozenThroughTaxYear`), CPI
  after. The cockpit's `drawdownSim` takes (2) and (3) too. Effect at 2% real, £60k, old drawdown: 2035 £2.28M → £2.26M,
  2075 £2.21M → £2.11M, lifetime tax £0.5k → £61k; at 0% the 2075 figure falls £0.42M → £0.31M. Survival unchanged.
  Known limitation `tfc-nominal-cap` closed; `thresholds-held-real` narrowed to the state pension.
- **Planning case draws each pension to the top of the basic-rate band** from the year it opens
  (`drawdown.strategy` = basicBand), instead of personal allowance + tax-free cash first (kept as scenario
  `paFillDrawdown`). Pensions enter the estate from April 2027; at 2% real / £60k this leaves about £1.27M to the
  children after inheritance tax and their income tax on inherited pensions, against about £0.95M the old way
  (about +£250k at £70k). It pays more income tax earlier (lifetime ~£280k vs ~£60k) and ends with a smaller estate
  (2075 £1.72M vs £2.11M) that is taxed far less. At 0% real the 2075 figure is ~£0.29M either way.
- **Gifts are not modelled.** The engine reports giftable surplus income each year (normal-expenditure exemption;
  about £10k/yr on average at £60k/2%, £5k at £70k); whether to give it is decided at the time, because every gift
  comes out of the buffer the plan relies on. New keys `iht.*` (nil-rate band £325k each, frozen to 2030/31 — CHECK;
  pensions in estate from 2027; beneficiary rate 40% GUESS). The house and residence nil-rate band stay outside.
- **Late-life tool (annuity trigger / rungs to 2054): deferred.** Chris: decide from ~2040 with real spend and pot
  sizes; the ladder makes 2035–45 certain and the house is the backstop. Noted: the residual risk in every stress
  test is after 2060, and the 2046–50 linkers are ~2.4% real today — a large fall in real yields before 2040 would
  make the extension dearer.
- **Pre-retirement spend is the household's to close, not a plan change.** Measured cost if it isn't: HB £20k and
  £80k to 2035 draw ~£115k of the £120k cash + crypto reserve and lower the 2035 pot by ~£120k; each £5k/yr of
  retirement spend is worth ~£430k at 2075 (2% real), four times the pre-retirement effect. Chris expects spend to
  fall by 2037 (less support for the children, off-peak holidays).
- Independent cross-check kept: `plan/derivations/independent-ledger.mjs` + `tests/unit/plan/independent.test.ts`.
  The accepted run 2026-09-21-phase7 is immutable and its inputs are now refused by the ledger (no `returns.cpi`);
  the next `plan:run` diffs against it and needs accepting.

## 24 Sep 2026 — run 2026-09-23 accepted (decision, Chris)

Baseline is now `plan/runs/2026-09-23` (supersedes 2026-09-21-phase7): the corrected engine with drawdown to the basic-rate
band. RED at run time for two expected reasons: the 2075 figure falls 22.5% (the drawdown change — a smaller estate that
leaves more to the children) and the trailing-12-month spend (£83.9k vs the £70k line), which stands as the target to close.

## 28 Sep 2026 — final adversarial challenge before buying; Plan E confirmed as is (decision, Chris)

Before the first purchase Chris asked for one more full challenge of Plan E. Method: the plan's own tax-aware ledger
with the ladder size varied (E £909k; June A £498k; E without SIPP rungs; bridge-only £350k; all equity; max floor
= all ISA + SIPP), at the live 28 Sep yields (~5bp above 23 Sep), over every historical start with 1.5% and 2.5% haircuts
on US real returns, plus high-valuation subsets: CAPE ≥ 20/22/25 full paths (1898–1969), and CAPE > 20 starts
1993–2025 with the unobserved future filled at 1/CAPE (2.56% real) or by resampled history. Scratch scripts
`tmp/adv-*.mjs` (not maintained).

- E is never worse on the downside in any test: it beats all equity everywhere and beats or ties A. In the worst 5%
  (2.5% haircut, all starts) E sustains £84k/yr vs A £81k and all equity £71k, and the pot never falls below
  ~£850k after 2035 (all equity ~£330k). From high-valuation starts with real history through the ladder window
  (1898–1969; 1993–2007) E also leaves the children the most at the median. Max floor adds nothing over E.
- The price is paid only in good worlds: A keeps £11–19k/yr more safe spend at the top quartile/decile and more estate
  where the children would already get £3–15M+. A's edge is concentrated in 2010–2020 starts that rode CAPE ~20 → 39,
  which a start at 39 cannot repeat on that scale.
- Deterministic check (E, £70k for life): 2% real → 2075 pot £1.09M, net to heirs £0.89M; 2.56% → £1.72M / £1.27M.
- External checks: gilts are explicitly NOT "cash-like" under the April 2027 ISA rules (only money market funds are);
  interest on uninvested cash in a stocks & shares ISA is taxed at 22% from April 2027, so coupons and redemptions
  should not sit as cash. Autumn Budget 28 Oct 2026: nothing reported changes the case. Linkers pay RPI to 2030
  (~1pp above CPI): an unmodelled ~£20k bonus, i.e. the plan is conservative. TR35 matures 22 Sep 2035, so Jun–Sep
  2035 comes from the cash floor.
- Confirmed by Chris: Abby has agreed Plan E and the ~£243k Vanguard → ii ISA transfer (cash due at ii by Fri 2 Oct);
  no debt of any kind (credit card cleared monthly); Chris's ii ISA and SIPP are in cash, ready to deal on 29 Sep.
- **Decision: execute Plan E as is** — Chris's ISA (2035–38 slice) and SIPP (2041–45) on 29 Sep, Abby's ISA
  (rest of 2038, 2039–40) when her transfer lands. Sized at the day's prices via `plan:order-sheet --save` + `plan:render`.
- Open, not blocking: ask L&G whether the Accenture scheme carries a protected pension age of 55 (flexibility only).
- Later on 28 Sep: `execution.html` now shows each gilt's ISIN (new observation `plan/observations/gilt-isins/`, from the
  DMO gilts-in-issue register, all 32 linkers matched to the price feed by name and redemption date) and a dealing note
  (quote the ISIN; compare total consideration incl. accrued with the cost column, not prices). Its lede now says to
  run `plan:order-sheet -- --save` before `plan:render` (render reads the newest saved prices). Tests 125 green.

## 29 Sep 2026 — the ladder is bought: Chris's ISA and SIPP rungs (execution record)

Pots rebased first to the cash Chris held on 28 Sep (`pots.chrisIiIsa` 279,029; `pots.chrisIiSipp` 442,488), priced at the
28 Sep close (the feed had not moved by 10:24 on the 29th). All trades 29 Sep, settle 1 Oct; recorded in `plan_ladder_rungs`.

| Rung | Gilt | Wrapper | Units (£ nominal) | Cost | Real value (today's £) |
|---|---|---|---|---|---|
| 2035 | TR35 | Chris ISA | 93,013.77 | £93,600 | £99.7k |
| 2036 | TG36 | Chris ISA | 62,205.87 (2 fills) | £82,915 | £100.0k |
| 2037 | TR37 | Chris ISA | 48,128.01 (2 fills) | £90,398 | £99.7k |
| 2038 (part) | T38 | Chris ISA | 10,983.23 | £11,077 | £11.6k |
| 2041 | T41 | Chris SIPP | 72,944.72 | £79,105 | £109.2k |
| 2042 + ½ 2043 | T42A | Chris SIPP | 82,820.02 | £125,280 | £163.4k |
| ½ 2043 + 2044 | T44 | Chris SIPP | 94,720.10 | £109,329 | £163.8k |
| 2045 | TR45 | Chris SIPP | 94,685.42 | £79,072 | £109.0k |

ISA £277,990 spent (~£1.0k cash left → LS100); SIPP £392,786 (~£49.7k left → global equity, the planned slice).
Every rung within 0.1–0.7% of plan; 2041–45 ≈ £109k/yr real, 2035–37 ≈ £100k/yr real.

- Execution slip, caught and fixed the same morning: the page's "Nominal to order (£)" column was typed into ii's online
  ticket as an amount in pounds. Harmless for TR35/T38 (≈£1 a unit), but TG36 (£1.33) and TR37 (£1.87) bought 25% and 47%
  short; both were topped up (TG36 +15,610.72, TR37 +22,498.82 units). TR35's 619-unit shortfall (0.6%) left as noise.
  The page now leads with a bold "£ to enter" column, shows "Units (check)" and clean/dirty price per unit, and says
  the ii ticket takes pounds. Engine carries `clean` through the ladder rows for this.
- Tests: four assertions pinned the 1 Sep pot literals; they now read the pots from `assumptions.json`. Golden
  `ledger-2027-isa-ladder` re-derived for the £521,829 ISA budget (527.5; working in `ledger-2027-row.md`).
- Still to do: Abby's ii ISA — rest of T38, TG39, TR40 (~£242.8k) when her Vanguard transfer lands (~2 Oct); size her
  T38 as the 2038 rung less Chris's £11.6k real. Then `plan:trigger -- rung-bought`, and the next `plan:run` needs accepting.

## 29 Sep 2026 — Plan E on one page, for Abby (new document)

Chris asked for a visual one-pager explaining Plan E to Abby: what sits where, what we have committed to until 2035,
where the money comes from after 2035 with the downside and upside, and anything else useful. It is rendered like every
other document: `plan/engine/brief.mjs` (pure; engine `2026-09-29.brief`) arranges the assumptions and the run's outputs
into `outputs.brief`, and `renderBrief` formats it as `plan-e-one-pager.html` in every run and render folder. CSS widths
of the bars are recorded through a new attribute emitter (`em.a`) so they are held to the outputs like every figure.
New FACT keys `dates.chrisBirthYear` / `dates.abbyBirthYear` give the ages shown. Tests 125 green.
