/**
 * Composable spending rule functions for the ERN engine.
 *
 * Each function takes the current state and returns a modified monthly withdrawal.
 * These can be chained together in any order.
 */

/**
 * Apply late-retirement spending decline (ERN Part 58).
 *
 * ERN's actual test: 0.90× at age 75, 0.80× from age 80.
 * ERN noted this made "amazingly little difference" to SWR but it's
 * realistic for real-world spending patterns (the "spending smile").
 *
 * @param monthlyWithdrawal - Current monthly withdrawal amount
 * @param age - Current age of retiree
 * @returns Adjusted monthly withdrawal
 */
export function applySpendingDecline(
  monthlyWithdrawal: number,
  age: number,
): number {
  if (age >= 80) return monthlyWithdrawal * 0.80;
  if (age >= 75) return monthlyWithdrawal * 0.90;
  return monthlyWithdrawal;
}

/**
 * Apply pension offset — reduce withdrawal when pension income starts.
 *
 * UK State Pension is triple-locked (CPI minimum), so it's modelled
 * as a real (inflation-adjusted) income stream.
 *
 * @param monthlyWithdrawal - Current monthly withdrawal amount
 * @param pensionMonthly - Monthly pension income
 * @param monthsSinceRetirement - Months since retirement start
 * @param pensionStartMonth - Month when pension kicks in
 * @returns Adjusted monthly withdrawal (never below 0)
 */
export function applyPensionOffset(
  monthlyWithdrawal: number,
  pensionMonthly: number,
  monthsSinceRetirement: number,
  pensionStartMonth: number,
): number {
  if (monthsSinceRetirement < pensionStartMonth) return monthlyWithdrawal;
  return Math.max(0, monthlyWithdrawal - pensionMonthly);
}

/**
 * Apply guardrail spending cut.
 *
 * When portfolio drops below threshold of peak, cut spending.
 * This is a simplified guardrail — Phase A noted that ERN's actual
 * GK-style formulation is different (cut if effective WR > 1.2× initial).
 * This version is kept for v1 and will be refined later.
 *
 * @param monthlyWithdrawal - Current monthly withdrawal amount
 * @param currentPortfolio - Current portfolio value
 * @param peakPortfolio - Peak portfolio value seen so far
 * @param threshold - Fraction of peak below which to apply cut (default 0.8)
 * @param cutFraction - How much to reduce spending (default 0.85 = 15% cut)
 * @returns Adjusted monthly withdrawal
 */
export function applyGuardrail(
  monthlyWithdrawal: number,
  currentPortfolio: number,
  peakPortfolio: number,
  threshold: number = 0.8,
  cutFraction: number = 0.85,
): number {
  if (currentPortfolio < peakPortfolio * threshold) {
    return monthlyWithdrawal * cutFraction;
  }
  return monthlyWithdrawal;
}

/**
 * Compute CAPE-based dynamic withdrawal rate (ERN Parts 18, 54).
 *
 * Formula: WR = a + b × (1/CAPE)
 * Default: a = 1.75%, b = 0.50 (ERN's confirmed recommendation)
 * Capped at 10% to prevent catastrophic depletion at extreme low CAPE.
 *
 * @param portfolioValue - Current portfolio value
 * @param cape - Current CAPE ratio
 * @param intercept - a parameter (default 1.75)
 * @param slope - b parameter (default 0.50)
 * @param cap - Maximum WR percentage (default 10)
 * @returns Monthly withdrawal amount
 */
export function computeCapeBasedWithdrawal(
  portfolioValue: number,
  cape: number,
  intercept: number = 1.75,
  slope: number = 0.50,
  cap: number = 10,
): number {
  if (cape <= 0) return 0;
  const annualWrPct = Math.min(cap, intercept + slope * (100 / cape));
  return (portfolioValue * annualWrPct / 100) / 12;
}

/**
 * Compute present value of future pension income (ERN Part 54 extension).
 *
 * Discounts future pension cash flows using the base CAPE WR as the discount rate.
 * This allows the dashboard to show: "Your pension is equivalent to £X in your portfolio."
 *
 * @param annualPension - Annual pension income (in today's money)
 * @param yearsUntilPension - Years until pension starts
 * @param yearsOfPension - Expected years of receiving pension (e.g., from 67 to 90 = 23)
 * @param discountRate - Annual real discount rate (default: base CAPE WR / 100)
 * @returns Present value of pension income stream
 */
export function computePensionPV(
  annualPension: number,
  yearsUntilPension: number,
  yearsOfPension: number,
  discountRate: number,
): number {
  if (annualPension <= 0 || discountRate <= 0) return 0;

  let pv = 0;
  for (let y = 0; y < yearsOfPension; y++) {
    const yearFromNow = yearsUntilPension + y;
    pv += annualPension / Math.pow(1 + discountRate, yearFromNow);
  }

  return pv;
}

/**
 * Compute Part 54 adjusted withdrawal rate with supplemental cash flows.
 *
 * ERN Part 54 3-step process:
 * 1. Compute base CAPE WR
 * 2. Add PV of future pension to portfolio
 * 3. Use PMT to compute depletion-adjusted WR
 *
 * @param portfolio - Current portfolio value
 * @param cape - Current CAPE ratio
 * @param annualPension - Annual pension income
 * @param yearsUntilPension - Years until pension starts
 * @param yearsOfPension - Expected years of receiving pension
 * @param horizonYears - Total retirement horizon in years
 * @param preserveFraction - Capital preservation target (0-1)
 * @returns Adjusted annual withdrawal amount
 */
export function computePart54AdjustedWithdrawal(
  portfolio: number,
  cape: number,
  annualPension: number,
  yearsUntilPension: number,
  yearsOfPension: number,
  horizonYears: number,
  preserveFraction: number,
): number {
  // Step 1: Base CAPE WR
  const baseWrPct = Math.min(10, 1.75 + 0.50 * (100 / cape));
  const baseRate = baseWrPct / 100;

  // Step 2: PV of pension income discounted at base rate
  const pensionPV = computePensionPV(
    annualPension,
    yearsUntilPension,
    yearsOfPension,
    baseRate,
  );

  // Augmented portfolio = portfolio + PV of pension
  const augmentedPortfolio = portfolio + pensionPV;

  // Step 3: PMT calculation for depletion-adjusted withdrawal
  // PMT = r × PV / (1 - (1+r)^-n) - r × FV / ((1+r)^n - 1)
  // where r = monthly rate, n = months, PV = augmented portfolio, FV = bequest
  const monthlyRate = baseRate / 12;
  const months = horizonYears * 12;
  const bequest = portfolio * preserveFraction; // bequest based on original portfolio

  if (monthlyRate === 0) {
    return (augmentedPortfolio - bequest) / months * 12;
  }

  const pvFactor = (1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate;
  const fvFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;

  const monthlyPmt = augmentedPortfolio / pvFactor - bequest / fvFactor;

  return Math.max(0, monthlyPmt * 12);
}
