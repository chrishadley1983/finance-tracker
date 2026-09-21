# plan/ — the household 50-year plan

This tree is the single home for the plan: its documents, its decisions, and (from phase 1) its
assumptions, engine, renderers and accepted runs. Design: `ARCHITECTURE.md`. Decision log:
`decisions.md` (append-only).

Status, 21 Sep 2026: **phases 0–4 complete.** Every planning number lives in `assumptions.json`
with provenance; every calculation lives in `engine/` (pure, injected, deterministic); the
measured inputs come in through `inputs/` — the only code that touches the database or the
price feed; and every document is rendered from a run's outputs by `render/` with no
hand-typed numbers (each figure is tagged with the outputs path it came from and a test reads
them all back). `engine/SPEC.md` states every formula.

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
| `tools/` | `set.mjs` (change an assumption), `ledger.mjs`, `avc.mjs`, `order-sheet.mjs` |
| `decisions.md` | append-only log of what was decided, when, and why |
| `ARCHITECTURE.md` | the drift-proof design and the seven phases |

## Rules (enforced by tests from phase 1)

1. The engine is pure and injected; same inputs produce byte-identical outputs, forever.
2. Three kinds of number, three homes: assumptions (`assumptions.json`), observations (`observations/`), outputs (`runs/<date>/outputs.json`). Nothing else may hold a planning literal.
3. Renderers do no arithmetic and contain no numeric literals.
4. Accepted runs are immutable.

Frozen material is never edited. If a frozen document is wrong, say so in its `FROZEN.md`.
