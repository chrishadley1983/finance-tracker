# plan/ — the household 50-year plan

This tree is the single home for the plan: its documents, its decisions, and (from phase 1) its
assumptions, engine, renderers and accepted runs. Design: `ARCHITECTURE.md`. Decision log:
`decisions.md` (append-only).

Status, 21 Sep 2026: **phases 0–5 complete.** Every planning number lives in `assumptions.json`
with provenance; every calculation lives in `engine/` (pure, injected, deterministic); the
measured inputs come in through `inputs/` — the only code that touches the database or the
price feed; every document is rendered from a run's outputs by `render/` with no hand-typed
numbers; and `plan:run` does the whole thing on a schedule, writes an immutable run folder,
diffs it against the last accepted run and tells you. `engine/SPEC.md` states every formula.

## The run cycle

```
npm run plan:run                 # live: collect → engine → diff vs accepted → render → plan/runs/<date>/ → notify (exit 1 on RED)
npm run plan:run -- --check-only # the same without writing a run folder
                                 # review plan/runs/<date>/diff.md and summary.html, then:
npm run plan:accept -- <date> --note "Q4 review"    # verify manifest, mark accepted, point LATEST_ACCEPTED at it, then commit as printed
```

Schedule: Task Scheduler `FinanceTracker-PlanRun-Quarterly` runs the full job at 07:30 on 1 Jan / 1 Apr /
1 Jul / 1 Oct (`scripts/run-plan-check.cmd`, log `plan-run.log`; register with
`scripts/register-plan-check-task.ps1`). The bank-sync task (weekly + 1st) also runs
`plan:check --live --notify` after each sync: drift vs the fresh snapshots, payslip age, and a
dead-man on the accepted run's age (AMBER at 80 days, RED at 100). Notifications: Discord if
`DISCORD_WEBHOOK_PLAN` is set in `.env.local`; email through the household SMTP config on RED or
failure. `diff.md` is always on disk whatever the notifications do. Tolerances: `inputs/diff-rules.json`.

An accepted run is immutable: `runs.test.ts` re-hashes every `ACCEPTED.json` folder against its
manifest. Frozen historical runs (`runs/2026-06-09-…`, `-07-30-…`, `-09-03-…`) predate this and have
no manifest.

```
npm run plan:check          # validate assumptions, DERIVED values, freshness, engine cross-checks (--live: + DB drift)
npm run plan:inputs         # collect assumptions + live observations → tmp/plan-inputs-<date>.json, print the drift report
npm run plan:ledger         # the Plan E ledger (add 0 / 0.04 for other returns; --json; --spend 70000 --cash 0 --crypto 0)
npm run plan:avc            # Abby's AVC% recipe from the newest payslip observation
npm run plan:payslip -- add --month 2026-09 --tax-month 6 --pay-date 2026-09-28 --basic … --taxable … --ytd-taxable … --net … --avc 55
npm run plan:order-sheet    # gilt order sheet sized by budget (live prices; --offline; --save; --budget N --years 2035-2040)
npm run plan:standalone     # runPlan() on the repo's current inputs → outputs JSON (the durability path)
npm run plan:render         # the documents from the repo's inputs → tmp/plan-render-<date>/ (or --inputs <file> --out <dir>)
```

**Monthly routine (until the phase-5 job automates it):** when Abby's payslip arrives, `plan:payslip add`
(it prints the `plan:set` commands if the basic moved and the new AVC%); after the 1st-of-month wealth
snapshot, `plan:inputs` (it flags any pot that drifted from the assumptions and the spend run-rate vs the
plan line); then `plan:check`.

## Changing a number

```
npm run plan:set -- payslip.basicAnnual 75000 --source "Abby payslip Oct 2026" --asof 2026-10-31
npm run plan:check          # validates, recomputes DERIVED, reports stale inputs, cross-checks the models
npm run plan:ledger         # the Plan E ledger from the current assumptions (add --json for machine output)
```

`plan:set` refuses DERIVED keys (change their inputs), pushes the old value onto `history`, and
re-validates before writing. New keys are added by editing the JSON with all provenance fields.
If the change is a decision, add a line to `decisions.md`; DECISION entries must cite it.

Statuses: `FACT` (documented), `CHECK` (verifiable, pending), `GUESS`, `DECISION` (cites
`decisions.md`), `DERIVED` (formula only — a hand-typed value is rejected by the loader).
`knownLimitations` lists what the models get wrong on purpose or not yet; it travels into every
generated document from phase 4.

## Layout

| Path | What |
|---|---|
| `runs/2026-06-09-june-plan/` | FROZEN — the June 2026 plan (Part One) |
| `runs/2026-07-30-amendment-1/` | FROZEN — Amendment 1, the Child Benefit / AVC pivot |
| `runs/2026-09-03-plan-e-ledger/` | FROZEN — Plan E ledger: 3 Sep original, 20 Sep revision, the model that produced each |
| `archive/2026-decision-scripts/` | FROZEN — the variant A/B/D/E comparison scripts (evidence for choosing Plan E; not maintained) |
| `archive/2026-adhoc-db-pulls/` | FROZEN — one-off DB pull scripts superseded by `plan/inputs/` in phase 3 |
| `assumptions.json` / `assumptions.schema.json` | THE home for chosen and quoted numbers, with provenance (phase 1) |
| `inputs/assumptions.mjs` | loader: validate, recompute DERIVED, freshness report; pure, no filesystem |
| `inputs/observe.mjs` | pure shaping of observations (latest balances → pots keys, income by source, payslip validation, the drift report with the §4 tolerances) |
| `inputs/db.ts`, `adapters.ts`, `collect.ts` | the DB adapters (snapshots, run-rate, income, rungs) and `collectInputs()` → the engine's inputs object (phase 3) |
| `inputs/gilt-prices.mjs`, `inputs/payslips.mjs` | the price feed (live with file fallback) and the payslip files |
| `engine/` | the plan's arithmetic: `tax`, `pivot`, `ladder`, `ledger`, `outlook`, `spend`; `index.mjs#runPlan(inputs)`; `run-standalone.mjs`; `SPEC.md` (phase 2) |
| `observations/gilt-prices/`, `gilt-yields/`, `payslips/` | dated measured inputs: market prices/yields and Abby's payslips |
| `derivations/` | `golden.json` + one note per anchor: values derived by hand OUTSIDE the engine; `tests/unit/plan/golden.test.ts` holds the engine to them |
| `render/` | `render.mjs` (summary.html — the page Abby reads; ledger.html; assumptions.md; avc-recipe.md; ledger.csv; order-sheet CSVs) and `fmt.mjs`; no arithmetic, no literals (phase 4) |
| `inputs/diff.mjs`, `diff-rules.json`, `manifest.mjs`, `notify.mjs` | run-vs-accepted comparison and its tolerances; sha256 manifests; Discord/email (phase 5) |
| `runs/<date>/` | one folder per run: `inputs.json`, `outputs.json`, `diff.md`, `summary.json`, the seven documents, `emissions.json`, `manifest.json`, and `ACCEPTED.json` once accepted; `runs/LATEST_ACCEPTED` names the current plan |
| `tools/` | `set.mjs` (change an assumption), `ledger.mjs`, `avc.mjs`, `order-sheet.mjs` |
| `decisions.md` | append-only log of what was decided, when, and why |
| `ARCHITECTURE.md` | the drift-proof design and the seven phases |

## Rules (enforced by tests from phase 1)

1. The engine is pure and injected; same inputs produce byte-identical outputs, forever.
2. Three kinds of number, three homes: assumptions (`assumptions.json`), observations (`observations/`), outputs (`runs/<date>/outputs.json`). Nothing else may hold a planning literal.
3. Renderers do no arithmetic and contain no numeric literals.
4. Accepted runs are immutable.

Frozen material is never edited. If a frozen document is wrong, say so in its `FROZEN.md`.
