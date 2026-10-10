# Run 2026-09-23 — RED

Compared with the last accepted run 2026-09-21-phase7.

| Level | Area | Item | Before | After | Detail |
|---|---|---|---|---|---|
| AMBER | assumptions | tax.thresholdsFrozenThroughTaxYear | undefined | 2030 |  |
| AMBER | assumptions | drawdown.strategy | undefined | "basicBand" |  |
| AMBER | assumptions | returns.cpi | undefined | 0.02 |  |
| AMBER | assumptions | iht.rate | undefined | 0.4 |  |
| AMBER | assumptions | iht.nilRateBandEach | undefined | 325000 |  |
| AMBER | assumptions | iht.frozenThroughTaxYear | undefined | 2030 |  |
| AMBER | assumptions | iht.pensionsInEstateFromTaxYear | undefined | 2027 |  |
| AMBER | assumptions | iht.beneficiaryIncomeTaxRate | undefined | 0.4 |  |
| OK | ledger | atRetirement | £2.28M | £2.26M | −1.0% |
| AMBER | ledger | atLastRung | £2.20M | £2.12M | −3.9% |
| RED | ledger | atEnd | £2.21M | £1.72M | −22.5% |
| OK | ladder | isa redemption per rung | £99k | £99k | yield-driven unless the budget moved |
| OK | ladder | sipp redemption per rung | £106k | £106k | yield-driven unless the budget moved |
| OK | ladder | cost vs budget | £909k | £909k | must equal the budget by construction |
| OK | outlook | sustainable spend | £97k | £97k |  |
| OK | inputs | pots.chrisIiIsa |  |  | assumed 276,716 vs snapshot 276,716 (2026-09-01, 0.0%) |
| OK | inputs | pots.abbyVanguardIsa |  |  | assumed 312,573 vs snapshot 312,573 (2026-09-01, 0.0%) |
| OK | inputs | pots.chrisIiSipp |  |  | assumed 439,574 vs snapshot 439,574 (2026-09-01, 0.0%) |
| OK | inputs | pots.chrisAccenturePension |  |  | assumed 193,081 vs snapshot 193,081 (2026-09-01, 0.0%) |
| OK | inputs | pots.abbyAccentureDc |  |  | assumed 282,921 vs snapshot 282,921 (2026-09-01, 0.0%) |
| OK | inputs | pots.otherSavings |  |  | assumed 119,924 vs snapshot 119,924 (2026-09-01, 0.0%) |
| OK | inputs | pots.accentureShares |  |  | assumed 1,960 vs snapshot 1,960 (2026-09-01, 0.0%) |
| RED | inputs | spend.planLine |  |  | trailing-12m spend 83,933 vs plan line 70,000 (+13,933) |
| OK | inputs | payslip age |  |  | newest payslip 2026-08-28 is 26 days old |
| OK | inputs | payslip.basicAnnual |  |  | assumption 73,837.8 vs payslip 73,837.8 |
| OK | inputs | ladder rungs |  |  | 0 of 0 bought, cost 0 of budget 909,390 |
