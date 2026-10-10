# Assumptions register

Prepared 2026-09-23; Sep 2026 pounds unless a unit says nominal. Generated 2026-09-23. Statuses: FACT documented · CHECK pending verification · GUESS · DECISION (cites plan/decisions.md) · DERIVED (formula, recomputed by the loader).

| Key | Value | Status | Source | As of | Review by |
|---|---|---|---|---|---|
| `payslip.asOf` | 2026-08 | FACT | Abby payslip Aug 2026 (tax month 05) | 2026-08-31 | 2026-10-15 |
| `payslip.basicAnnual` | 73,838 | FACT | Abby payslip Aug 2026: basic £6,153.15/mo x 12 | 2026-08-31 | 2026-10-15 |
| `payslip.carAllowance` | 6,500 | FACT | Abby payslip: £541.67/mo, not pensionable, assumed flat | 2026-08-31 | 2027-04-06 |
| `payslip.medicalBik` | 1,330 | FACT | Abby payslip: £110.83/mo payrolled benefit; note tax code 1117L also codes out £1,400 (double-taxed ~£560/yr, to square via self-assessment) | 2026-08-31 | 2027-04-06 |
| `payslip.bonusRate` | 0.05 | GUESS | 5% assumed; bonus confirmed sacrificeable (Chris, 20 Sep 2026). True up in January when known | 2026-07-30 | 2027-01-31 |
| `payslip.existingEeRate` | 0.045 | FACT | Abby payslip: 4.5% employee salary sacrifice on basic (shows inside Pension ER) | 2026-08-31 | 2027-04-06 |
| `payslip.employerRate` | 0.11 | FACT | Abby payslip: Accenture 11% on basic; no match on AVCs assumed | 2026-08-31 | 2027-04-06 |
| `payslip.payGrowth` | 0.02 | GUESS | planning assumption (Amendment 1); Apr→Aug 2026 actual was +5.6% | 2026-07-30 | 2027-09-01 |
| `tax.personalAllowance` | 12,570 | FACT | gov.uk income tax rates 2026/27; frozen to Apr 2031 (Autumn Budget 2025) | 2026-04-06 | 2027-04-06 |
| `tax.basicRateBand` | 37,700 | FACT | gov.uk 2026/27: 20% band above the allowance; frozen to Apr 2031 | 2026-04-06 | 2027-04-06 |
| `tax.higherRateFloor` | 50,270 | FACT | gov.uk 2026/27: personal allowance + basic-rate band | 2026-04-06 | 2027-04-06 |
| `tax.thresholdsFrozenThroughTaxYear` | 2,030 | FACT | Autumn Budget 2025: personal allowance and higher-rate threshold frozen to April 2031. CPI-indexed afterwards is the model's assumption | 2025-11-26 | 2027-04-06 |
| `tax.basicRate` | 0.2 | FACT | gov.uk 2026/27 | 2026-04-06 | 2027-04-06 |
| `tax.higherRate` | 0.4 | FACT | gov.uk 2026/27 | 2026-04-06 | 2027-04-06 |
| `tax.payeAllowance` | 11,179 | CHECK | Abby tax code 1117L (Apr and Aug 2026 payslips both reconcile to it). Should be 1257L less the payrolled medical only once — query with HMRC | 2026-08-31 | 2027-01-31 |
| `tax.niMainRate` | 0.08 | FACT | gov.uk employee Class 1 2026/27, between primary threshold and UEL | 2026-04-06 | 2027-04-06 |
| `tax.niUpperRate` | 0.02 | FACT | gov.uk employee Class 1 2026/27, above UEL | 2026-04-06 | 2027-04-06 |
| `tax.niPrimaryThreshold` | 12,570 | FACT | gov.uk 2026/27 | 2026-04-06 | 2027-04-06 |
| `tax.niUpperEarningsLimit` | 50,270 | FACT | gov.uk 2026/27 | 2026-04-06 | 2027-04-06 |
| `tax.reliefAbove` | 0.42 | FACT | 40% income tax + 2% employee NI on salary-sacrificed pay above £50,270 (2026/27). BREAKS Apr 2029: salary-sacrifice NIC cap (Autumn Budget 2025) removes the 2% on the excess over £2k/yr → 0.40; the model must branch by tax year from 2029/30 | 2026-04-06 | 2029-04-06 |
| `tax.salarySacrificeNicCapFromTaxYear` | 2,029 | FACT | Autumn Budget 26 Nov 2025: from April 2029 pension salary sacrifice above £2,000 a year attracts employee and employer NIC. Verify the final legislation before 2029/30 | 2025-11-26 | 2028-12-31 |
| `tax.salarySacrificeNicCapThreshold` | 2,000 | FACT | Autumn Budget 26 Nov 2025 announcement; the existing 4.5% payroll sacrifice already exceeds it, so the whole AVC is NI-able from 2029/30 | 2025-11-26 | 2028-12-31 |
| `tax.reliefBelow` | 0.28 | FACT | 20% income tax + 8% employee NI (2026/27) | 2026-04-06 | 2027-04-06 |
| `hicbc.lowerThreshold` | 60,000 | FACT | gov.uk High Income Child Benefit Charge from Apr 2024; not indexed | 2026-04-06 | 2027-04-06 |
| `hicbc.upperThreshold` | 80,000 | FACT | gov.uk HICBC: fully withdrawn at £80,000 | 2026-04-06 | 2027-04-06 |
| `hicbc.taperPerStep` | 0.01 | FACT | gov.uk HICBC: 1% of the benefit per £200 of income over the lower threshold | 2026-04-06 | 2027-04-06 |
| `hicbc.stepSize` | 200 | FACT | gov.uk HICBC taper step | 2026-04-06 | 2027-04-06 |
| `hicbc.operatingTarget` | 59,500 | DECISION | plan/decisions.md — Amendment 1 (30 Jul 2026): operate £500 under the £60k line against payroll noise; reaffirmed 20 Sep 2026 | 2026-07-30 | 2027-01-31 |
| `childBenefit.annual2026` | 2,337 | FACT | gov.uk rates from Apr 2026: £27.05 eldest + £17.90 second, x 52 (uprated 3.8% from £26.05/£17.25). Claim reinstated Sep 2026; 12 weeks arrears received 4 Sep | 2026-04-06 | 2027-04-06 |
| `childBenefit.uprating` | 0.02 | GUESS | CPI assumption for the programme sums | 2026-07-30 | 2027-04-06 |
| `childBenefit.emmieEndsAug` | 2,035 | FACT | Child Benefit runs to the 31 Aug after A-levels finish, not 18; Emmie finishes Year 13 summer 2035 | 2026-07-30 | 2027-09-01 |
| `childBenefit.maxEndsAug` | 2,037 | FACT | As above; Max finishes Year 13 summer 2037 | 2026-07-30 | 2027-09-01 |
| `pivot.years` | 9 | DECISION | plan/decisions.md — Amendment 1: programme 2026/27 to 2034/35, ending at retirement June 2035 | 2026-07-30 | 2027-09-01 |
| `pivot.firstTaxYear` | 2,026 | DECISION | plan/decisions.md — AVC started on the September 2026 payslip (decided 20 Sep 2026) | 2026-09-20 | 2027-04-06 |
| `pots.chrisIiIsa` | 276,716 | FACT | finance.wealth_snapshots 2026-09-01, CH ISA | 2026-09-01 | 2026-10-15 |
| `pots.abbyVanguardIsa` | 312,573 | FACT | finance.wealth_snapshots 2026-09-01, Abby S&S ISA | 2026-09-01 | 2026-10-15 |
| `pots.chrisIiSipp` | 439,574 | FACT | finance.wealth_snapshots 2026-09-01, Chris II SIPP Pension | 2026-09-01 | 2026-10-15 |
| `pots.chrisAccenturePension` | 193,081 | FACT | finance.wealth_snapshots 2026-09-01, Chris Accenture Pens (Plan E doc rounded to 192,659) | 2026-09-01 | 2026-10-15 |
| `pots.abbyAccentureDc` | 282,921 | FACT | finance.wealth_snapshots 2026-09-01, Abby Accenture Pension | 2026-09-01 | 2026-10-15 |
| `pots.otherSavings` | 119,924 | FACT | finance.wealth_snapshots 2026-09-01, Other Savings (cash buffer + crypto) | 2026-09-01 | 2026-10-15 |
| `pots.accentureShares` | 1,960 | FACT | finance.wealth_snapshots 2026-09-01, Accenture Shares | 2026-09-01 | 2026-10-15 |
| `pots.cashBuffer` | 66,000 | CHECK | Plan E ledger split of Other Savings: ~£66k cash, ~£54k crypto (1 BTC, 6 ETH). Not separately snapshotted | 2026-09-01 | 2026-12-31 |
| `pots.crypto` | 53,924 | DERIVED | = pots.otherSavings - pots.cashBuffer |  |  |
| `pots.chrisPension` | 632,655 | DERIVED | = sum(pots.chrisIiSipp, pots.chrisAccenturePension) |  |  |
| `pots.abbyPension` | 282,921 | DERIVED | = pots.abbyAccentureDc |  |  |
| `pots.nonPension` | 711,173 | DERIVED | = sum(pots.chrisIiIsa, pots.abbyVanguardIsa, pots.otherSavings, pots.accentureShares) |  |  |
| `pots.total` | 1,626,749 | DERIVED | = sum(pots.chrisPension, pots.abbyPension, pots.nonPension) |  |  |
| `accounts.potsMap` | (7 entries — see assumptions.json) | FACT | finance.accounts names → the pots.* assumption each snapshot refreshes; plan:inputs reports drift between them | 2026-09-21 | 2027-03-31 |
| `accounts.bucketMap` | (14 entries — see assumptions.json) | FACT | finance.accounts names as of Sep 2026 → plan buckets; unlisted accounts fall back by type | 2026-09-20 | 2027-03-31 |
| `spend.planLine` | 70,000 | DECISION | plan/decisions.md — 20 Sep 2026: plan on £70k (the tracker shows ~£77–85k on the cockpit definition; 2026 was a heavy holiday year). Was 69,500 from the June plan, never reproducible from the tracker | 2026-09-20 | 2027-01-31 |
| `spend.retirementTarget` | 60,000 | DECISION | plan/decisions.md — June 2026 plan, reaffirmed 20 Sep 2026 as the floor plan (£70k is the 2%-real case only) | 2026-06-09 | 2027-09-01 |
| `spend.excludedCategories` | Home improvement,Extension,Lego Out,Work Travel | DECISION | plan/decisions.md — categories excluded from the run-rate (one-offs, business, reimbursed); cockpit definition | 2026-07-30 | 2027-01-31 |
| `spend.nineYearSavingsDrawBudget` | 8,000 | GUESS | Amendment 1 at £25k HB and £69.5k spend. Stale: on the 20 Sep inputs (HB ~£19k, spend £70k+) the draw is £40k–£130k; see plan/decisions.md | 2026-07-30 | 2026-12-31 |
| `income.hbPreRetirement` | 25,000 | DECISION | plan/decisions.md — Amendment 1 target, kept 20 Sep 2026 while Chris works to close the gap (2026 tracking ~£19k profit / ~£17.4k take-home; £5k side income planned). Shortfalls come from the reserve, never the AVC | 2026-09-20 | 2026-12-31 |
| `income.hbPostRetirement` | 13,000 | GUESS | Amendment 1: HB continues inside Chris's personal allowance until his pension opens | 2026-07-30 | 2027-09-01 |
| `income.abbyTakeHomeYear1` | 43,498 | DERIVED (engine) | = engine:takeHomeNominal(0, extraSacrifice at hicbc target 60000) |  |  |
| `dates.planRetirementYear` | 2,035 | DECISION | plan/decisions.md — June 2026 plan: both stop June 2035 when Max finishes Year 11 | 2026-06-09 | 2027-09-01 |
| `dates.chrisPensionAccessYear` | 2,040 | FACT | Chris born Nov 1983; normal minimum pension age 57 from 6 Apr 2028 (Finance Act 2022). Check whether the II SIPP carries a protected age of 55 | 2026-07-30 | 2027-09-01 |
| `dates.abbyPensionAccessYear` | 2,043 | FACT | Abby born Aug 1986; NMPA 57 | 2026-07-30 | 2027-09-01 |
| `dates.chrisStatePensionYear` | 2,051 | FACT | Pensions Act 2007: SPA 68 for those born on/after 6 Apr 1978; the 2017 proposal to bring it forward was never legislated | 2026-07-30 | 2027-09-01 |
| `dates.abbyStatePensionYear` | 2,054 | FACT | Pensions Act 2007 | 2026-07-30 | 2027-09-01 |
| `dates.simulationEndYear` | 2,075 | DECISION | plan/decisions.md — model horizon | 2026-06-09 | 2027-09-01 |
| `statePension.annualEach` | 12,548 | FACT | Full new state pension 2026/27: £241.30/wk x 52 (uprated 4.8% Apr 2026). Forecasts not yet pulled; assume full records | 2026-04-06 | 2027-04-06 |
| `drawdown.tfcCapEach` | 268,275 | FACT | Lump sum allowance from Apr 2024, frozen in cash (no indexation in the legislation): the engine erodes it by returns.cpi and caps tax-free cash at 25% of what is crystallised | 2026-04-06 | 2027-04-06 |
| `drawdown.ufplsTaxableFraction` | 0.75 | FACT | UFPLS: 25% tax-free, 75% taxable | 2026-04-06 | 2027-04-06 |
| `drawdown.strategy` | basicBand | DECISION | plan/decisions.md — 23 Sep 2026: from each pension's access year draw taxable pension income to the top of the basic-rate band (inheritance-tax aware); the surplus stays in ISA/GIA and is reported as giftable income; gifts themselves are not modelled. The previous case (personal allowance only, tax-free cash first) is kept as 'paFill' for comparison | 2026-09-23 | 2027-09-01 |
| `ladder.firstYear` | 2,035 | DECISION | plan/decisions.md — Plan E: first rung matures Sep 2035 | 2026-09-03 | 2027-09-01 |
| `ladder.lastYear` | 2,045 | DECISION | plan/decisions.md — Plan E: eleven rungs 2035–2045; the 2046+ extension was cancelled by Amendment 1 | 2026-09-03 | 2027-09-01 |
| `ladder.abbyIiIsaTransfer` | 242,800 | DECISION | plan/decisions.md — Plan E: about £243k transfers from Abby's Vanguard ISA to a new II ISA for rungs 2038–40; the rest stays in equity at Vanguard. Sizing by budget means this figure does not move with yields | 2026-09-03 | 2026-12-31 |
| `ladder.sippEquityRetained` | 49,700 | DECISION | plan/decisions.md — Plan E: about £50k of Chris's II SIPP stays in equity; the rest buys rungs 2041–45 | 2026-09-03 | 2026-12-31 |
| `ladder.isaBudgetReal` | 519,516 | DERIVED | = sum(pots.chrisIiIsa, ladder.abbyIiIsaTransfer) |  |  |
| `ladder.sippBudgetReal` | 389,874 | DERIVED | = pots.chrisIiSipp - ladder.sippEquityRetained |  |  |
| `ladder.budgetReal` | 909,390 | DERIVED | = sum(ladder.isaBudgetReal, ladder.sippBudgetReal) |  |  |
| `nmw.hourlyRate` | 13 | FACT | National Minimum Wage 21+ from 1 Apr 2026 (gov.uk). Salary sacrifice must not take paid basic below NMW; tested per pay period | 2026-04-01 | 2027-04-01 |
| `nmw.hoursPerWeek` | 40 | GUESS | Abby's contracted hours assumed 40 (37.5 would give a floor of £24.9k). CHECK on the contract | 2026-09-20 | 2026-12-31 |
| `nmw.weeklyFloor` | 508 | DERIVED | = nmw.hourlyRate * nmw.hoursPerWeek |  |  |
| `nmw.annualFloor` | 26,508 | DERIVED | = nmw.weeklyFloor * 52.14 |  |  |
| `returns.realEquity.planning` | 0.02 | GUESS | planning case; deliberately close to what index-linked gilts guarantee today (2.0–2.4% real) | 2026-06-09 | 2027-09-01 |
| `returns.realEquity.better` | 0.04 | GUESS | the long-run global equity average, shown as the upside case | 2026-06-09 | 2027-09-01 |
| `returns.cashReal` | 0.005 | GUESS | Plan E ledger | 2026-09-03 | 2027-09-01 |
| `returns.cpi` | 0.02 | GUESS | CPI planning assumption (the Bank of England target; same rate as payslip.payGrowth and childBenefit.uprating). Converts nominal amounts to today's money: the AVC schedule, thresholds frozen in cash, the lump sum allowance, the IHT nil-rate band | 2026-09-23 | 2027-09-01 |
| `ledger.cashFloor` | 30,000 | DECISION | plan/decisions.md — Plan E: cash is not drawn below this before a taxed pension draw | 2026-09-03 | 2027-09-01 |
| `ledger.isaAllowanceCouple` | 40,000 | FACT | 2 x £20,000 adult ISA allowance (2026/27) | 2026-04-06 | 2027-04-06 |
| `iht.rate` | 0.4 | FACT | gov.uk inheritance tax rate above the nil-rate band | 2026-04-06 | 2027-04-06 |
| `iht.nilRateBandEach` | 325,000 | CHECK | gov.uk nil-rate band £325,000 each, transferable between spouses. The residence nil-rate band (£175k each, tapered away above a £2M estate) is not used: the house is outside the model | 2026-04-06 | 2027-04-06 |
| `iht.frozenThroughTaxYear` | 2,030 | CHECK | Nil-rate bands frozen to April 2030 (Autumn Budget 2024), extended to April 2031 at Autumn Budget 2025 — verify on gov.uk. CPI-indexed afterwards is the model's assumption | 2025-11-26 | 2027-04-06 |
| `iht.pensionsInEstateFromTaxYear` | 2,027 | FACT | Autumn Budget 2024: unused pension funds and death benefits fall into the estate for inheritance tax from 6 April 2027 | 2024-10-30 | 2027-04-06 |
| `iht.beneficiaryIncomeTaxRate` | 0.4 | GUESS | An inherited pension is taxed as the beneficiary's income when the member dies after 75 (both would be at the horizon); assumes Emmie and Max are higher-rate taxpayers when they draw it | 2026-09-23 | 2027-09-01 |

## What this model knowingly gets wrong

- **thresholds-held-real** — The personal allowance and higher-rate threshold are frozen in cash to 2030/31 and CPI-indexed after (modelled from 23 Sep 2026). Still held constant in real terms: the state pension (the triple lock would raise it), the ISA allowance and the cash floor. Small, opposite-signed biases. _(≈£0.5k/yr of tax from 2041)_
- **nic-cap-2029** — From April 2029 salary-sacrificed pension contributions above £2,000/yr attract employee and employer NIC. MODELLED from 21 Sep 2026 (tax.salarySacrificeNicCapFromTaxYear / Threshold): the pivot loses the NI part of the relief on the AVC from 2029/30 (about £3.7k over the programme) and take-home reflects it. NOT modelled: Accenture withdrawing or capping the salary-sacrifice AVC facility once its own 15% employer-NIC saving disappears — confirm the facility survives before relying on 2029/30+ years. _(≈£3.7k take-home now in the numbers; scheme-availability risk unquantified)_ — fix by 2029-04-06
- **fees-and-crypto** — Platform and dealing fees (~£8k to 2045) are unmodelled; crypto (~£54k) is treated as equity at 2% real and never drawn; the sustainable-spend column in the ledger document is the 3 Sep outlook figure and £70k/yr does not survive the flat-0% case under the ledger's tax rules. _(small)_
- **iht-estimate** — The estate figure is an order of magnitude: both are assumed to die at the horizon, the house and its residence nil-rate band are outside the model, lifetime gifts (and the seven-year rule) are not modelled, and Emmie and Max are assumed to be higher-rate taxpayers when they draw inherited pensions. _(estate and net-to-heirs only; survival unaffected)_
- **gia-untaxed** — Drawing to the basic-rate band pushes surpluses beyond the ISA allowance into a general account, whose dividends and gains are treated as untaxed. At the planning case the GIA reaches a few hundred £k by the 2060s; dividend and capital gains tax on it are not deducted. _(slightly flatters the late-life balance under the basicBand strategy)_

