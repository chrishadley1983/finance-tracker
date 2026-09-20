# plan/ — the household 50-year plan

This tree is the single home for the plan: its documents, its decisions, and (from phase 1) its
assumptions, engine, renderers and accepted runs. Design: `ARCHITECTURE.md`. Decision log:
`decisions.md` (append-only).

Status, 20 Sep 2026: **phases 0 and 1 complete.** Every planning number now lives in
`assumptions.json` with provenance; the cockpit (`lib/plan/constants.ts` is a thin shim over it),
the ledger model (`scripts/ifa-e-yearly.mjs`) and the AVC calculator all read it. The models
themselves still live in `lib/plan/*` and `scripts/`; they fold into `plan/engine/` in phase 2.

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
| `observations/gilt-prices/`, `observations/gilt-yields/` | dated market observations used by the ladder tools and the ledger |
| `tools/set.mjs` | change one assumption safely (`npm run plan:set`) |
| `decisions.md` | append-only log of what was decided, when, and why |
| `ARCHITECTURE.md` | the drift-proof design and the seven phases |

## Rules (enforced by tests from phase 1)

1. The engine is pure and injected; same inputs produce byte-identical outputs, forever.
2. Three kinds of number, three homes: assumptions (`assumptions.json`), observations (`observations/`), outputs (`runs/<date>/outputs.json`). Nothing else may hold a planning literal.
3. Renderers do no arithmetic and contain no numeric literals.
4. Accepted runs are immutable.

Frozen material is never edited. If a frozen document is wrong, say so in its `FROZEN.md`.
