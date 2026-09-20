# plan/ — the household 50-year plan

This tree is the single home for the plan: its documents, its decisions, and (from phase 1) its
assumptions, engine, renderers and accepted runs. Design: `ARCHITECTURE.md`. Decision log:
`decisions.md` (append-only).

Status, 20 Sep 2026: **phase 0 complete** — everything that was untracked is now in git and frozen.
Nothing in `plan/` is executable yet; the live tools are still `scripts/ifa-e-yearly.mjs`
(ledger model), `scripts/abby-avc-calculator.mjs` (AVC recipe), `scripts/gilt-ladder.mjs`
(order sheet) and `lib/plan/*` (cockpit engine). Those fold into `plan/engine/` in phase 2.

## Layout

| Path | What |
|---|---|
| `runs/2026-06-09-june-plan/` | FROZEN — the June 2026 plan (Part One) |
| `runs/2026-07-30-amendment-1/` | FROZEN — Amendment 1, the Child Benefit / AVC pivot |
| `runs/2026-09-03-plan-e-ledger/` | FROZEN — Plan E ledger: 3 Sep original, 20 Sep revision, the model that produced each |
| `archive/2026-decision-scripts/` | FROZEN — the variant A/B/D/E comparison scripts (evidence for choosing Plan E; not maintained) |
| `archive/2026-adhoc-db-pulls/` | FROZEN — one-off DB pull scripts superseded by `plan/inputs/` in phase 3 |
| `decisions.md` | append-only log of what was decided, when, and why |
| `ARCHITECTURE.md` | the drift-proof design and the seven phases |

## Rules (enforced by tests from phase 1)

1. The engine is pure and injected; same inputs produce byte-identical outputs, forever.
2. Three kinds of number, three homes: assumptions (`assumptions.json`), observations (`observations/`), outputs (`runs/<date>/outputs.json`). Nothing else may hold a planning literal.
3. Renderers do no arithmetic and contain no numeric literals.
4. Accepted runs are immutable.

Frozen material is never edited. If a frozen document is wrong, say so in its `FROZEN.md`.
