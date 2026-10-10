# Run 2026-10-01 — RED

Compared with the last accepted run 2026-09-23.

| Level | Area | Item | Before | After | Detail |
|---|---|---|---|---|---|
| AMBER | assumptions | payslip.asOf | "2026-08" | "2026-09" |  |
| AMBER | assumptions | payslip.employerRate | 0.11 | 0.12 |  |
| OK | assumptions | pots.chrisIiIsa | 276716 | 279029 |  |
| OK | assumptions | pots.chrisIiSipp | 439574 | 442488 |  |
| OK | assumptions | pots.chrisPension | 632655 | 635569 |  |
| OK | assumptions | pots.nonPension | 711173 | 713486 |  |
| OK | assumptions | pots.total | 1626749 | 1631976 |  |
| AMBER | assumptions | dates.chrisBirthYear | undefined | 1983 |  |
| AMBER | assumptions | dates.abbyBirthYear | undefined | 1986 |  |
| AMBER | assumptions | ladder.isaBudgetReal | 519516 | 521829 |  |
| AMBER | assumptions | ladder.sippBudgetReal | 389874 | 392788 |  |
| AMBER | assumptions | ladder.budgetReal | 909390 | 914617 |  |
| AMBER | assumptions | returns.historyHaircut | undefined | 0.025 |  |
| AMBER | assumptions | returns.expensiveCapeFrom | undefined | 20 |  |
| OK | ledger | atRetirement | £2.26M | £2.28M | +0.6% |
| OK | ledger | atLastRung | £2.12M | £2.13M | +0.8% |
| OK | ledger | atEnd | £1.72M | £1.74M | +1.5% |
| OK | ladder | isa redemption per rung | £99k | £99k | yield-driven unless the budget moved |
| OK | ladder | sipp redemption per rung | £106k | £107k | yield-driven unless the budget moved |
| OK | ladder | cost vs budget | £915k | £915k | must equal the budget by construction |
| OK | outlook | sustainable spend | £97k | £98k |  |
| RED | pivot | AVC % to set | 55% | 46% | act on the payslip |
| OK | inputs | pots.chrisIiIsa |  |  | assumed 279,029 vs snapshot 276,716 (2026-09-01, 0.8%) |
| OK | inputs | pots.abbyVanguardIsa |  |  | assumed 312,573 vs snapshot 312,573 (2026-09-01, 0.0%) |
| OK | inputs | pots.chrisIiSipp |  |  | assumed 442,488 vs snapshot 439,574 (2026-09-01, 0.7%) |
| OK | inputs | pots.chrisAccenturePension |  |  | assumed 193,081 vs snapshot 193,081 (2026-09-01, 0.0%) |
| OK | inputs | pots.abbyAccentureDc |  |  | assumed 282,921 vs snapshot 282,921 (2026-09-01, 0.0%) |
| OK | inputs | pots.otherSavings |  |  | assumed 119,924 vs snapshot 119,924 (2026-09-01, 0.0%) |
| OK | inputs | pots.accentureShares |  |  | assumed 1,960 vs snapshot 1,960 (2026-09-01, 0.0%) |
| RED | inputs | spend.planLine |  |  | trailing-12m spend 84,761 vs plan line 70,000 (+14,761) |
| OK | inputs | payslip age |  |  | newest payslip 2026-09-30 is 1 days old |
| OK | inputs | payslip.basicAnnual |  |  | assumption 73,837.8 vs payslip 73,837.8 |
| OK | inputs | ladder rungs |  |  | 8 of 11 bought, cost 659,699 of budget 914,617 |
