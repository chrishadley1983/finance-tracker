# Life-event triggers — what to touch when something happens

Each assumption in `assumptions.json` carries a `triggers` list. `npm run plan:trigger -- <event>` prints
the keys that event touches, with their current values and review dates, plus the checklist below.
Events are lower-case tokens; the first table is the vocabulary.

| Event | When | What to do |
|---|---|---|
| `payslip` | Abby's payslip arrives (monthly) | `npm run plan:payslip -- add …` from the PDF. It prints the `plan:set` commands if the basic moved and the AVC% for the remaining months. Then `npm run plan:check`. |
| `job-change` | Abby changes role, employer or hours; pay rise outside the April round | Re-read the offer: basic, car allowance, bonus rate, employer/employee pension rates, sacrifice facility, contracted hours (`nmw.hoursPerWeek`). `plan:set` each changed key; a new payslip when it lands. Full `plan:run` and accept. |
| `bonus-confirmed` | January, when the bonus is known | `plan:set payslip.bonusRate` if it differs from 5%; add the January payslip; the recipe re-trues the AVC for the last payslips. |
| `april` | 6 April, new tax year (and any Budget) | Every `cadence: tax-year` key: personal allowance, bands, NI rates and thresholds, HICBC thresholds, Child Benefit rate, NMW, state pension, lump-sum allowance, ISA allowance. `plan:check` goes AMBER from 1 March to remind. Full `plan:run` and accept. From April 2029 also `tax.reliefAbove` (salary-sacrifice NIC cap). |
| `budget` | A fiscal event changes a rule mid-year | Same keys as `april`, only those announced; note the effective date in `source`. |
| `snapshot` | The 1st-of-month wealth snapshot is entered | Nothing to type: `plan:inputs` (or the bank-sync hook's `plan:check --live`) reads it and flags any pot that drifted from `pots.*`. If it has, `plan:set` the pot from the snapshot. |
| `new-account` | An account is opened, closed or renamed in the tracker | `accounts.bucketMap` (which bucket) and `accounts.potsMap` (which `pots.*` key, if it is one of the plan's pots). |
| `rung-bought` | A gilt is bought on II | Mark it bought in the `/plan` cockpit (or the rungs table) with cost and face; `ladder.abbyIiIsaTransfer` / `ladder.sippEquityRetained` if the actual amounts differed. `plan:run` to check ladder cost vs budget. |
| `ratchet` | Equities are well ahead of what the plan needs (annual look) | Decision in `decisions.md`; extend `ladder.lastYear` or buy earlier rungs; `plan:run` and accept. |
| `hb-trend` | HB profit two quarters running >20% off `income.hbPreRetirement` | Decision in `decisions.md`; `plan:set income.hbPreRetirement` (it is take-home). |
| `quarterly` | Each quarterly run | Review `spend.planLine` against the trailing-12m run-rate in the diff; `spend.excludedCategories` if the tracker's categories changed. |
| `retirement-date` | The June 2035 date is reconsidered | `dates.planRetirementYear`, `ladder.firstYear`, `pivot.years`; scenario run first (`plan:ledger -- …`), then decision, then accept. |
| `kid-milestone` | Emmie/Max leave full-time education earlier or later than Aug 2035/2037 | `childBenefit.emmieEndsAug`, `childBenefit.maxEndsAug`. |
| `annual` | Once a year (September) | Re-examine every `GUESS` (`plan:set --list` and filter); zip `plan/` off-git; pick one golden at random and re-derive it by hand. |
| `event` | Anything not above | If a number changes, it changes in `assumptions.json` with its source and date, and a line in `decisions.md`. |

## Redundancy, illness, death — scenario overrides, never the base file

Do not edit `assumptions.json` to model a shock. Run the ledger with knobs (`npm run plan:ledger -- --spend 80000
--hb 0 --cash 0`) or write an override JSON and run the engine on it; record the conclusion in `decisions.md`. The
base file describes the plan you are operating, not the case you are worrying about.

## After any trigger

1. `npm run plan:check` (structure, DERIVED values, freshness) — and `--live` if pots or the run-rate are involved.
2. If the change is material, `npm run plan:run`, read `diff.md`, then `npm run plan:accept -- <date>` and commit.
3. Say why in `plan/decisions.md`. DECISION entries must cite it.
