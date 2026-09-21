# plan/engine — specification

Pure ES modules. Every function takes the resolved assumptions object `a` (from
`plan/inputs/assumptions.mjs`) as its first argument; nothing here reads a file, the
network or the clock. `runPlan(inputs)` in `index.mjs` is the only entry point the run
job uses; the modules are also callable one at a time (the cockpit binds them through
`lib/plan/*.ts`). Written so it can be re-implemented in a spreadsheet if JavaScript is
ever unavailable — see `../HOW-TO-RERUN-2040.md` (phase 6).

Money: nominal £ in the pivot (per tax year); real £ (today's money) everywhere else,
£k in the ledger.

## tax.mjs

- **netPay(a, cash, taxable)** = cash − tax − NI, where
  tax = basicRate × min(max(taxable − payeAllowance, 0), basicRateBand) + higherRate × max(taxable − payeAllowance − basicRateBand, 0);
  NI = niMainRate × max(min(cash, UEL) − PT, 0) + niUpperRate × max(cash − UEL, 0).
  Additional rate and the £100k allowance taper are not modelled (never reached under the pivot).
- **personTax(a, income)** = basicRate × max(min(income, higherRateFloor) − personalAllowance, 0) + higherRate × max(income − higherRateFloor, 0).
- **childBenefitKept(a, ani, full)** = full if ani ≤ lower; 0 if ani ≥ upper; else full × (1 − taperPerStep × floor((ani − lower)/stepSize)).
- **reliefOnSacrifice(a, aniBefore, extra)** = reliefAbove × (part of the band [aniBefore − extra, aniBefore] above higherRateFloor) + reliefBelow × the rest.
- **annuity(n, g)** = (1 − (1+g)^−n)/g (n if g = 0; 0 if n ≤ 0).

## pivot.mjs

For programme year i (0 = a.pivot.firstTaxYear):
basic_i = basicAnnual × (1 + payGrowth)^i; package = basic + bonusRate×basic + carAllowance + medicalBik;
aniBefore = package − existingEeRate × basic; **extra = max(aniBefore − target, 0)**; aniAfter = aniBefore − extra;
takeHomeCut = extra − reliefOnSacrifice; cbFull = annual2026 × (1 + uprating)^i; cbKept per HICBC; netCost = cut − kept;
avcPct = ceil(100 × extra / basic). **takeHomeNominal(a, i, extra)** = netPay(cash, cash + medicalBik) with
cash = basic(1 − existingEeRate) + bonusRate×basic + carAllowance − extra. **currentRetune** picks the year
containing `today` (UK tax year from 6 April). **avcRecipeFromYtd(a, slip)**: ANI_doNothing = ytdTaxable +
(12 − taxMonth) × taxablePayMonthly + bonus (unless sacrificed) + otherTaxableIncome − extraAvcAlreadyTaken;
extraNeeded = max(ANI − operatingTarget, 0); avcPct = ceil(100 × extraNeeded/(remaining × basicMonthly));
landedAni, take-home cut at (1 − reliefAbove), paid basic vs the NMW floor.

## ladder.mjs

Cost of £1 of real redemption of a linker = clean/100 (face = real/indexRatio, cost = face × dirty/100,
indexRatio ≈ dirty/clean). **allocate** covers a target year with its own maturity, else half each on the
nearest earlier and later maturities. **sizeByBudget(prices, budget, years)** = budget ÷ Σ_years cost-per-£1.
**buildLadder(a, prices, opts)** sizes by `a.ladder.budgetReal` over `firstYear..lastYear` unless `amountPerYear`
is given; returns allocations, per-gilt totals (face, cost, real amount) and totals. **couponSchedule** = Σ over
gilts still outstanding of coupon rate × real amount held, per year (the top-up, not part of the rung).

## ledger.mjs — runLedger(a, yields, {G, spend, hbPost, cash, crypto})

Rows from BASE (2026, the snapshot balances) to `dates.simulationEndYear`; growth applies from BASE+1:
equity × (1+G), cash × (1+cashReal), each ladder × (1+IRR_w). Per wrapper w ∈ {isa, sipp}: price per £1 of
rung y = cpn × annuity(n, yld) + (1+yld)^−n with n = y − BASE; **R_w = budget_w ÷ Σ mult × price**; annual flows
= coupons on outstanding rungs + R_w in each pay year (ISA: firstYear..chrisPensionAccessYear, SIPP: the rest);
IRR_w solves PV(flows) = budget_w. Flows leave the ladder balance each year; before retirement they are
reinvested in-wrapper, in ISA years they are the year's cash, in SIPP years they stay as pension equity.
Abby's DC receives extra_i (pivot at the £60k line) + payroll (basicAnnual × (employerRate + existingEeRate)) in
rows BASE+1..retirement. From retirement each year: spend (retirementTarget), HB to chrisPensionAccessYear,
state pensions from the year after each SPA year, PA-filling draws once each pension is open, tax =
personTax on each person's taxable income; a shortfall is met in order TFC (Chris then Abby, each capped at
tfcCapEach), ISA equity, GIA, cash down to cashFloor, then a taxed pension draw grossed up at basicRate;
a surplus goes to ISA equity (up to isaAllowanceCouple after the ISA rung years, the rest to GIA).

## outlook.mjs

**potsAtExit**: each pot × (1+r)^n plus, per working year i, Abby's (payroll + extra_i deflated) and the
household cash delta (takeHome_i deflated + child benefit + hbPreRetirement − planLine), each grown from mid-year.
**sustainableSpend** = (pots + PV of both state pensions + PV of HB) ÷ annuity(horizon − retireYear, r).
**drawdownSim**: three buckets (Chris pension, Abby pension, non-pension) drawn in the order UFPLS to fill each
personal allowance → tax-free-cash strips (25% of the crystallised slice, cumulative cap) → non-pension →
taxed draws (basic rate on the taxable fraction); surplus recycled to non-pension; all buckets grow at r.

## spend.mjs

**computeRunRate(a, txns)**: over transactions whose category is not income, not excluded, and not in
`spend.excludedCategories`: spend = Σ debits − Σ credits (refunds, reimbursements and contributions are filed
in the category they offset and net against it); vsPlanLine = spend − planLine; grossSpend and creditsNetted
are returned alongside. Excluded categories are netted the same way for the excludedTotal. **bucketTotals(a, snapshots)**: latest balance per
account → bucket by `accounts.bucketMap` (pension by name, property/tracking/credit/other excluded,
else accessible); with no snapshots, the assumptions' pots.
