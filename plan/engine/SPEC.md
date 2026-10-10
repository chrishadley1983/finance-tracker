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
- **personTax(a, income, scale = 1)** = basicRate × max(min(income, higherRateFloor·scale) − personalAllowance·scale, 0) + higherRate × max(income − higherRateFloor·scale, 0).
- **frozenInCash(a, year, frozenThrough)** = (1 + returns.cpi)^−(clamp(year, 2026, frozenThrough) − 2026): today's-money value of £1 frozen in cash from 2026/27 through tax year `frozenThrough` and CPI-indexed after (Infinity for the lump sum allowance, which has no indexation). Row year y is tax year y/y+1.
- **thresholdScale(a, year)** = frozenInCash(a, year, tax.thresholdsFrozenThroughTaxYear) — applied to the personal allowance and higher-rate threshold in retirement.
- **childBenefitKept(a, ani, full)** = full if ani ≤ lower; 0 if ani ≥ upper; else full × (1 − taperPerStep × floor((ani − lower)/stepSize)).
- **reliefOnSacrifice(a, aniBefore, extra, {taxYearStart, existingSacrifice})** = reliefAbove × (part of the band [aniBefore − extra, aniBefore] above higherRateFloor) + reliefBelow × the rest, **minus the employee NI no longer saved once the salary-sacrifice NIC cap applies**: from tax year `salarySacrificeNicCapFromTaxYear` (2029/30, Autumn Budget 2025) sacrifice above `salarySacrificeNicCapThreshold` (£2,000 a year, all pension sacrifice counted) stays NI-able, so with **nicLiableSacrifice(a, taxYearStart, extra, existingSacrifice)** = max(0, extra − max(0, threshold − existingSacrifice)) (0 before the cap year) the relief loses niUpperRate × (liable part above the UEL) + niMainRate × (the rest). Without a `taxYearStart` the pre-cap formula applies (the YTD recipe for the current year).
- **annuity(n, g)** = (1 − (1+g)^−n)/g (n if g = 0; 0 if n ≤ 0).

## pivot.mjs

For programme year i (0 = a.pivot.firstTaxYear):
basic_i = basicAnnual × (1 + payGrowth)^i; package = basic + bonusRate×basic + carAllowance + medicalBik;
aniBefore = package − existingEeRate × basic; **extra = max(aniBefore − target, 0)**; aniAfter = aniBefore − extra;
takeHomeCut = extra − reliefOnSacrifice; cbFull = annual2026 × (1 + uprating)^i; cbKept per HICBC; netCost = cut − kept;
avcPct = ceil(100 × extra / basic). **takeHomeNominal(a, i, extra)** = netPay(cash, cash + medicalBik) − niOnExtra with
cash = basic(1 − existingEeRate) + bonusRate×basic + carAllowance − extra and niOnExtra = NI(cash + liable) − NI(cash)
for the NI-liable sacrifice of that tax year (0 before 2029/30). **currentRetune(a, target, today)** picks the year
containing `today` (UK tax year from 6 April); the engine never reads the clock. **avcRecipeFromYtd(a, slip)**: ANI_doNothing = ytdTaxable +
(12 − taxMonth) × taxablePayMonthly + bonus (unless sacrificed) + otherTaxableIncome − extraAvcAlreadyTaken;
extraNeeded = max(ANI − operatingTarget, 0); avcPct = ceil(100 × extraNeeded/(remaining × basicMonthly));
landedAni, take-home cut at (1 − reliefAbove), paid basic vs the NMW floor.

## ladder.mjs

Cost of £1 of real redemption of a linker = clean/100 (face = real/indexRatio, cost = face × dirty/100,
indexRatio ≈ dirty/clean). **allocate** covers a target year with its own maturity, else half each on the
nearest earlier and later maturities. **sizeByBudget(prices, budget, years)** = budget ÷ Σ_years cost-per-£1.
**buildLadder(a, prices, opts)** sizes by `a.ladder.budgetReal` over `firstYear..lastYear` unless `amountPerYear`
is given; returns allocations, per-gilt totals (face, cost, real amount) and totals. **couponSchedule** = Σ over
gilts still outstanding of coupon rate × real amount held, per year (the top-up, not part of the rung). **splitByHolder(plan, firstBudget, [h1, h2])** walks the wrapper’s gilts in maturity order: h1 takes whole gilts until firstBudget is spent, the gilt that straddles the boundary is split pro rata (face, cost, real amount), the rest is h2 — the ISA rungs between Chris’s ii ISA (firstBudget = pots.chrisIiIsa) and Abby’s.

## ledger.mjs — runLedger(a, yields, {G, gPath, spend, spendSchedule, hbPost, cash, crypto, preRetirement, extension})

Rows from BASE (2026, the snapshot balances) to `dates.simulationEndYear`; growth applies from BASE+1:
equity × (1+G_t), cash × (1+cashReal), each ladder × (1+IRR_w). G_t is the flat `G` or, when `gPath` (an array of
annual real returns, one per year from BASE+1) is given, that year's path value. Per wrapper w ∈ {isa, sipp}:
price per £1 of rung y = cpn × annuity(n, yld) + (1+yld)^−n with n = y − BASE; **R_w = budget_w ÷ Σ mult × price**;
annual flows = coupons on outstanding rungs + R_w in each pay year (ISA: firstYear..chrisPensionAccessYear, SIPP:
the rest); IRR_w solves PV(flows) = budget_w. Spend from retirement is `spend` (default retirementTarget) or a
`spendSchedule` [{fromYear, spend}, …] (each step applies from its year). **preRetirement {spend, hbTakeHome,
cottrell, sideIncome}** adds, for each working year, delta = takeHome_i (deflated) + child benefit kept + cottrell +
sideIncome + hbTakeHome − spend; a negative delta is drawn cash → crypto → Abby ISA-equivalent → new ISA equity → GIA
and the cumulative draw is reported as `headline.preRetirementDraw`. **extension {budget, fromYear, toYear, source}**
sizes a third wrapper on the `w:'ext'` rungs in the yields file (rung R_ext = budget ÷ Σ price, own IRR), funded
from `source` ('acn' = the Accenture pension pot, which then holds the ext ladder instead of equity) and paid in
fromYear..toYear like the SIPP rungs. `headline` = {atRetirement, atLastRung, atEnd, firstCashNegative,
preRetirementDraw}. Flows leave the ladder balance each year; before retirement they are
reinvested in-wrapper, in ISA years they are the year's cash, in SIPP years they stay as pension equity.
Abby's DC receives extra_i × (1 + cpi)^−i (the pivot works in each tax year's cash against a frozen £60k line, so
its sacrifice is deflated to today's money; `avcScheduleNominal` keeps the cash figures) + payroll (basicAnnual ×
(employerRate + existingEeRate)) in rows BASE+1..retirement. The pre-retirement take-home is deflated by cpi too.

**Retirement rows** (from 23 Sep 2026, engine `2026-09-23.real-terms`). Each year: spend (retirementTarget or the
schedule), HB to chrisPensionAccessYear, state pensions from the year after each SPA year. Thresholds are
personalAllowance and higherRateFloor × thresholdScale(year). Per person P ∈ {Chris, Abby} the engine tracks the
liquid pension pot (Chris: sippEq + acn, into which the SIPP rungs mature; Abby: abbyDC), the drawdown fund
crys_P (crystallised, not yet withdrawn, fully taxable, grows with equity) and the lump sum allowance lsa_P in
NOMINAL £ (its real value is lsa_P × frozenInCash(year, ∞)).
- **drawTaxable(P, T)**: take d = min(T, crys_P) from the drawdown fund; for the rest, crystallise x from the
  uncrystallised pot with t = x/4 tax-free while the allowance lasts: x = 4(T−d)/3 if (T−d)/3 ≤ L, else x = (T−d) + L
  (L = the allowance's real value), so the taxable part is exactly T; t reduces lsa_P by t / frozenInCash.
- **takeTfc(P, want)** ('paFill' only): t = min(want, L, (pot − crys_P)/4); crystallise 4t, pay t, crys_P += 3t.
- **Strategy `drawdown.strategy`** (or opts.drawdown). 'basicBand' (planning case): once P's pension is open,
  drawTaxable(P, higherRateFloor·scale − P's other taxable income). 'paFill' (the pre-23-Sep case):
  drawTaxable(P, personalAllowance·scale − other income).
- tax = personTax(inc_P, scale) summed. net = ISA rung cash (ISA years) + HB + SP + draws − spend − tax.
  A shortfall is met in order: ('paFill' only) takeTfc Chris then Abby; ISA equity; GIA; cash down to cashFloor;
  then taxed draws a band at a time (gross = short/(1 − marginal rate), capped at the next threshold), Chris then
  Abby; anything left makes the cash line negative (crypto is never drawn). A surplus goes to ISA equity (up to
  isaAllowanceCouple after the ISA rung years, the rest to GIA) and, once a pension is open,
  **giftable** = max(0, min(surplus, taxable income − tax − spend)) — surplus income, not capital, is what the
  normal-expenditure exemption covers. Gifts are reported, never deducted.
- **estate** at simulationEndYear (both assumed to die then; spouse exemption on the first death): total, pensions,
  nilRateBands = 2 × iht.nilRateBandEach × frozenInCash(END, iht.frozenThroughTaxYear); iht = iht.rate ×
  max(0, total − nilRateBands) (pensions count from iht.pensionsInEstateFromTaxYear); beneficiaryTax =
  iht.beneficiaryIncomeTaxRate × (pensions − the IHT share falling on them); netToHeirs = total − iht −
  beneficiaryTax. The house and the residence nil-rate band are outside the model.
- `headline` adds iht and netToHeirs; old inputs without returns.cpi are refused (re-run them at their manifest sha).
- Cross-check: `plan/derivations/independent-ledger.mjs` re-implements this from scratch;
  `tests/unit/plan/independent.test.ts` holds the two within 1% at 0/2/4% real under both strategies.

## scenarios.mjs — runScenarios(a, yields, {shiller, capeThreshold})

Every scenario is `runLedger` with different knobs, each at G ∈ {0, returns.realEquity.planning, .better}:
baseline; spend = planLine; spend = planLine + 10k; paFillDrawdown (the planning case with the 'paFill' strategy); step-down (planLine + 10k from retirement, retirementTarget +
5k from childBenefit.maxEndsAug + 3); reserve spent (cash = crypto = 0); Chris £20k take-home pre-retirement at
spend = planLine and planLine + 10k (cottrell 3,000, side income 0); ratchet (extension budget =
pots.chrisAccenturePension over lastYear+1..lastYear+5, only when the yields file has `ext` rungs). **Grid**:
spend ∈ {retirementTarget, planLine, planLine + 10k} × G ∈ {0, 1%, planning, 3%, better}. **Replay**: for every
start month m in the Shiller record with a full (simulationEndYear − 2026)-year path, gPath_i = Π of the 12 monthly
real US equity returns (bps) from m + 12i, minus 1; gilts keep their locked real yields. Stats over all starts and
over starts with CAPE ≥ capeThreshold (25: 1901 and 1928–30 with full paths): count, share whose cash line went
negative, worst / 5th / median / 95th percentile of `atEnd`.

## outlook.mjs

**potsAtExit**: each pot × (1+r)^n plus, per working year i, Abby's (payroll + extra_i deflated) and the
household cash delta (takeHome_i deflated + child benefit + hbPreRetirement − planLine), each grown from mid-year.
**sustainableSpend** = (pots + PV of both state pensions + PV of HB) ÷ annuity(horizon − retireYear, r).
**drawdownSim**: three buckets (Chris pension, Abby pension, non-pension) drawn in the order UFPLS to fill each
personal allowance (× thresholdScale; the lump sum allowance cap is nominal, worth cap × frozenInCash(year, ∞)) → tax-free-cash strips (25% of the crystallised slice, cumulative cap) → non-pension →
taxed draws (basic rate on the taxable fraction); surplus recycled to non-pension; all buckets grow at r.

## spend.mjs

**computeRunRate(a, txns)**: over transactions whose category is not income, not excluded, and not in
`spend.excludedCategories`: spend = Σ debits − Σ credits (refunds, reimbursements and contributions are filed
in the category they offset and net against it); vsPlanLine = spend − planLine; grossSpend and creditsNetted
are returned alongside. Excluded categories are netted the same way for the excludedTotal. **bucketTotals(a, snapshots)**: latest balance per
account → bucket by `accounts.bucketMap` (pension by name, property/tracking/credit/other excluded,
else accessible); with no snapshots, the assumptions' pots.
