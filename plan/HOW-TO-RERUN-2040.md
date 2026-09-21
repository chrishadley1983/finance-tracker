# How to re-run the plan in 2040 (or whenever the app is gone)

Written 21 Sep 2026 for a future reader with none of today's tooling. Everything you need is in
this `plan/` folder and it is deliberately boring: JSON, Markdown, CSV, self-contained HTML, and
plain JavaScript modules with no dependencies.

## What you have

- `assumptions.json` — every number the plan chose or quoted, each with where it came from, when, and
  when it should be reviewed. `assumptions.schema.json` says what a valid file looks like.
- `observations/` — measured inputs by date: gilt prices, the gilt yields used for the ladder, and
  Abby's payslips.
- `engine/` — the arithmetic. `engine/SPEC.md` states every formula in prose; the `.mjs` files are the
  same formulas as code. `engine/index.mjs#runPlan(inputs)` is the only entry point.
- `runs/<date>/` — one folder per run. `inputs.json` is the complete input the engine saw (assumptions
  plus observations), `outputs.json` everything it computed, the `.html`/`.md`/`.csv` files the
  documents rendered from it, `manifest.json` the checksums, `ACCEPTED.json` if it was signed off.
  `runs/LATEST_ACCEPTED` names the run that is "the plan".
- `derivations/` — hand workings for a set of anchor numbers, so you can check the engine is still
  right without trusting it.
- `decisions.md` — why things are what they are.

## To read the plan as it stood

Open `runs/<LATEST_ACCEPTED>/summary.html` in any browser. It has no external dependencies.

## To re-run it

1. Get any JavaScript runtime that understands ES2020 modules (Node, Deno, Bun, or a browser).
2. `node plan/engine/run-standalone.mjs plan/runs/<date>/inputs.json > outputs.json`
   This needs nothing but the runtime: no database, no network, no secrets. The output must equal
   the `outputs.json` in that folder byte for byte (the manifest has its checksum).
3. To render the documents from an outputs file, `node plan/tools/render.mjs --inputs <inputs.json>`
   (this one reads the repo's `assumptions.json` for the register; copy the run's inputs if you
   have nothing else).

## To update it

1. Edit `assumptions.json` — by hand following the schema, or `node plan/tools/set.mjs <key> <value>
   --source "…" --asof YYYY-MM-DD`. Never type a value into a `DERIVED` entry; change its inputs.
2. Add observations: a payslip JSON in `observations/payslips/YYYY-MM.json` (copy the newest and change
   the numbers), gilt prices from any source in the same shape as `observations/gilt-prices/*.json`.
3. Build an inputs file: with the tooling, `npm run plan:inputs --offline`; without it, copy the newest
   run's `inputs.json` and replace the `assumptions` object with the resolved values from your edited
   file (each `DERIVED` key computed from its `formula`).
4. Run step 2 above, render, read, decide, write it in `decisions.md`.

## If JavaScript itself is gone

`engine/SPEC.md` is enough to rebuild the whole thing in a spreadsheet: the pivot is a per-year
formula, the ladder is a price-per-pound sum, the ledger is a year-by-year table with a fixed draw
order. The golden derivations give you sixteen numbers to check your rebuild against.

## What the model knowingly gets wrong

`assumptions.json` → `knownLimitations`, also printed at the foot of every generated document. Read it
before trusting the tax lines.
