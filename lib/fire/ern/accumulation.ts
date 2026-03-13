/**
 * Accumulation-phase projection for pre-retirement modelling.
 *
 * Projects the current portfolio forward to retirement using a
 * CAPE-implied real return and a future-value annuity for savings.
 *
 * This is an approximation used by the historical simulation path
 * (which can't model accumulation month-by-month). The Monte Carlo
 * engine handles accumulation natively in its month loop.
 */

/**
 * Project the portfolio value at retirement.
 *
 * portfolio × (1 + r)^years  +  annualSavings × [((1 + r)^years − 1) / r]
 *
 * The second term is the future-value-of-annuity formula for
 * contributions made at the start of each year.
 *
 * @param portfolio      Current portfolio value
 * @param annualSavings  Annual contributions during accumulation
 * @param years          Years until retirement
 * @param realReturnPct  Expected real return (%, e.g. 3.0 for 3%)
 * @returns Projected portfolio value at retirement
 */
export function projectPortfolioAtRetirement(
  portfolio: number,
  annualSavings: number,
  years: number,
  realReturnPct: number,
): number {
  if (years <= 0) return portfolio;

  const r = realReturnPct / 100;

  // Handle zero-return edge case (no compounding)
  if (Math.abs(r) < 1e-10) {
    return portfolio + annualSavings * years;
  }

  const growthFactor = Math.pow(1 + r, years);

  // FV of existing portfolio
  const portfolioFV = portfolio * growthFactor;

  // FV of annuity (contributions at start of each year)
  const annuityFV = annualSavings * ((growthFactor - 1) / r);

  return portfolioFV + annuityFV;
}
