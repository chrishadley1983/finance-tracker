# plan/ — the household 50-year plan

This tree is the single home for the plan: its documents, its decisions, and (from phase 1) its
assumptions, engine, renderers and accepted runs. Design: `ARCHITECTURE.md`. Decision log:
`decisions.md` (append-only).

Status, 21 Sep 2026: **phases 0–2 complete.** Every planning number lives in `assumptions.json`
with provenance, and every calculation lives in `engine/` (pure, injected, deterministic). The
cockpit's `lib/plan/*.ts` are one-line bindings of the engine to the repo's assumptions; the
operating tools in `tools/` use the same engine. `engine/SPEC.md` states every formula.

```
npm run plan:check          # validate assumptions, DERIVED values, freshness, engine cross-checks
npm run plan:ledger         # the Plan E ledger (add 0 / 0.04 for other returns; --json; --spend 70000 --cash 0 --crypto 0)
npm run plan:avc            # Abby's AVC% recipe from the newest payslip observation
npm run plan:order-sheet    # gilt order sheet sized by budget (live prices; --offline; --budget N --years 2035-2040)
npm run plan:standalone     # runPlan() on the repo's current inputs → outputs JSON (the durability path)
```

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
| `engine/` | the plan's arithmetic: `tax`, `pivot`, `ladder`, `ledger`, `outlook`, `spend`; `index.mjs#runPlan(inputs)`; `run-standalone.mjs`; `SPEC.md` (phase 2) |
| `observations/gilt-prices/`, `gilt-yields/`, `payslips/` | dated measured inputs: market prices/yields and Abby's payslips |
| `derivations/` | `golden.json` + one note per anchor: values derived by hand OUTSIDE the engine; `tests/unit/plan/golden.test.ts` holds the engine to them |
| `tools/` | `set.mjs` (change an assumption), `ledger.mjs`, `avc.mjs`, `order-sheet.mjs` |
| `decisions.md` | append-only log of what was decided, when, and why |
| `ARCHITECTURE.md` | the drift-proof design and the seven phases |

## Rules (enforced by tests from phase 1)

1. The engine is pure and injected; same inputs produce byte-identical outputs, forever.
2. Three kinds of number, three homes: assumptions (`assumptions.json`), observations (`observations/`), outputs (`runs/<date>/outputs.json`). Nothing else may hold a planning literal.
3. Renderers do no arithmetic and contain no numeric literals.
4. Accepted runs are immutable.

Frozen material is never edited. If a frozen document is wrong, say so in its `FROZEN.md`.
