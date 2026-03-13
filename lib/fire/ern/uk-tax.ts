/**
 * UK Tax Calculator for FIRE drawdown modelling.
 *
 * Covers income tax (rUK bands), National Insurance (not applicable in
 * retirement drawdown), Capital Gains Tax, and dividend tax.
 *
 * All amounts are annual GBP. Thresholds are 2025-26 values.
 * Fiscal drag is modelled by freezing nominal thresholds while
 * real income grows with inflation.
 */

// =============================================================================
// 2025-26 Tax Parameters (frozen since 2021)
// =============================================================================

/** Personal Allowance — tapers £1 for every £2 over £100k */
export const PERSONAL_ALLOWANCE = 12_570;

/** Income threshold where PA taper begins */
export const PA_TAPER_THRESHOLD = 100_000;

/** PA is fully lost at this income (100k + 2 × 12,570) */
export const PA_ZERO_THRESHOLD = PA_TAPER_THRESHOLD + 2 * PERSONAL_ALLOWANCE;

/** Income tax bands (rUK, not Scotland) */
export const TAX_BANDS = [
  { name: 'basic', lower: 0, upper: 37_700, rate: 0.20 },
  { name: 'higher', lower: 37_700, upper: 125_140, rate: 0.40 },
  { name: 'additional', lower: 125_140, upper: Infinity, rate: 0.45 },
] as const;

/** CGT annual exempt amount (2025-26) */
export const CGT_ALLOWANCE = 3_000;

/** CGT rates on gains (after allowance) */
export const CGT_BASIC_RATE = 0.10; // Within basic rate band
export const CGT_HIGHER_RATE = 0.20; // Above basic rate band

/** Dividend allowance (2025-26) */
export const DIVIDEND_ALLOWANCE = 1_000;

/** Dividend tax rates */
export const DIVIDEND_BASIC_RATE = 0.0875;
export const DIVIDEND_HIGHER_RATE = 0.3375;
export const DIVIDEND_ADDITIONAL_RATE = 0.3938;

/** Personal Savings Allowance */
export const PSA_BASIC = 1_000;
export const PSA_HIGHER = 500;

// =============================================================================
// Income Tax
// =============================================================================

/**
 * Compute the personal allowance after taper.
 *
 * PA reduces by £1 for every £2 of income over £100,000.
 * Fully lost at £125,140.
 */
export function getPersonalAllowance(grossIncome: number): number {
  if (grossIncome <= PA_TAPER_THRESHOLD) return PERSONAL_ALLOWANCE;
  if (grossIncome >= PA_ZERO_THRESHOLD) return 0;
  const reduction = Math.floor((grossIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}

/**
 * Compute income tax on gross income.
 *
 * Applies PA (with taper), then taxes through basic/higher/additional bands.
 * Does NOT include NI (not relevant for pension/investment income).
 *
 * @param grossIncome - Total taxable income (pension drawdown + state pension + employment)
 * @returns Tax payable
 */
export function computeIncomeTax(grossIncome: number): number {
  if (grossIncome <= 0) return 0;

  const pa = getPersonalAllowance(grossIncome);
  const taxableIncome = Math.max(0, grossIncome - pa);

  let tax = 0;
  let remaining = taxableIncome;

  for (const band of TAX_BANDS) {
    const bandWidth = band.upper - band.lower;
    const taxableInBand = Math.min(remaining, bandWidth);
    if (taxableInBand <= 0) break;
    tax += taxableInBand * band.rate;
    remaining -= taxableInBand;
  }

  return tax;
}

/**
 * Compute net income after income tax.
 */
export function computeNetIncome(grossIncome: number): number {
  return grossIncome - computeIncomeTax(grossIncome);
}

/**
 * Compute effective tax rate on gross income.
 */
export function computeEffectiveTaxRate(grossIncome: number): number {
  if (grossIncome <= 0) return 0;
  return computeIncomeTax(grossIncome) / grossIncome;
}

/**
 * Compute marginal tax rate at a given income level.
 *
 * In the PA taper zone (£100k-£125,140), effective marginal rate is 60%
 * (40% + 20% from losing £1 PA per £2 income).
 */
export function computeMarginalRate(grossIncome: number): number {
  if (grossIncome <= 0) return 0;

  const pa = getPersonalAllowance(grossIncome);
  const taxableIncome = grossIncome - pa;

  // In PA taper zone: 60% marginal
  if (grossIncome > PA_TAPER_THRESHOLD && grossIncome < PA_ZERO_THRESHOLD) {
    return 0.60;
  }

  // Find which band the last pound falls in
  let remaining = taxableIncome;
  for (const band of TAX_BANDS) {
    const bandWidth = band.upper - band.lower;
    if (remaining <= bandWidth) return band.rate;
    remaining -= bandWidth;
  }

  return TAX_BANDS[TAX_BANDS.length - 1].rate;
}

// =============================================================================
// Capital Gains Tax
// =============================================================================

/**
 * Compute CGT on realised gains.
 *
 * Uses the basic rate band remaining after income to determine
 * which CGT rate applies.
 *
 * @param gains - Total realised gains in the tax year
 * @param grossIncome - Total income (to determine basic/higher rate status)
 * @returns CGT payable
 */
export function computeCGT(gains: number, grossIncome: number): number {
  const taxableGains = Math.max(0, gains - CGT_ALLOWANCE);
  if (taxableGains <= 0) return 0;

  const pa = getPersonalAllowance(grossIncome);
  const taxableIncome = Math.max(0, grossIncome - pa);

  // Basic rate band remaining after income
  const basicBandRemaining = Math.max(0, TAX_BANDS[0].upper - taxableIncome);

  // Gains within basic band
  const gainsAtBasic = Math.min(taxableGains, basicBandRemaining);
  const gainsAtHigher = taxableGains - gainsAtBasic;

  return gainsAtBasic * CGT_BASIC_RATE + gainsAtHigher * CGT_HIGHER_RATE;
}

// =============================================================================
// Dividend Tax
// =============================================================================

/**
 * Compute dividend tax on dividend income.
 *
 * @param dividends - Total dividend income
 * @param otherIncome - Non-dividend income (to determine band)
 * @returns Dividend tax payable
 */
export function computeDividendTax(
  dividends: number,
  otherIncome: number,
): number {
  const taxableDividends = Math.max(0, dividends - DIVIDEND_ALLOWANCE);
  if (taxableDividends <= 0) return 0;

  const pa = getPersonalAllowance(otherIncome + dividends);
  const totalTaxableIncome = Math.max(0, otherIncome + dividends - pa);
  const nonDivTaxable = Math.max(0, otherIncome - pa);

  // Where do dividends fall in the bands?
  let tax = 0;
  let divRemaining = taxableDividends;
  let incomeConsumed = nonDivTaxable;

  // Basic band
  const basicRemaining = Math.max(0, TAX_BANDS[0].upper - incomeConsumed);
  const divInBasic = Math.min(divRemaining, basicRemaining);
  tax += divInBasic * DIVIDEND_BASIC_RATE;
  divRemaining -= divInBasic;
  incomeConsumed += divInBasic;

  // Higher band
  const higherRemaining = Math.max(
    0,
    TAX_BANDS[0].upper + (TAX_BANDS[1].upper - TAX_BANDS[1].lower) - incomeConsumed,
  );
  const divInHigher = Math.min(divRemaining, higherRemaining);
  tax += divInHigher * DIVIDEND_HIGHER_RATE;
  divRemaining -= divInHigher;

  // Additional
  if (divRemaining > 0) {
    tax += divRemaining * DIVIDEND_ADDITIONAL_RATE;
  }

  return tax;
}

// =============================================================================
// Fiscal Drag
// =============================================================================

/**
 * Apply fiscal drag to tax thresholds.
 *
 * Models the effect of frozen nominal thresholds when real income grows.
 * Returns what the thresholds would be if they'd been indexed to inflation.
 * The difference between tax at frozen vs indexed thresholds = fiscal drag cost.
 *
 * @param yearsFromNow - Years of threshold freeze
 * @param inflationRate - Annual CPI rate (e.g., 0.025 for 2.5%)
 * @returns The real (inflation-adjusted) personal allowance
 */
export function realPersonalAllowance(
  yearsFromNow: number,
  inflationRate: number,
): number {
  // Frozen nominal PA expressed in future real terms
  return PERSONAL_ALLOWANCE / Math.pow(1 + inflationRate, yearsFromNow);
}

/**
 * Compute the extra tax paid due to fiscal drag in a given year.
 *
 * Compares tax at frozen thresholds vs inflation-indexed thresholds.
 *
 * @param realIncome - Income in today's money
 * @param yearsFromNow - Years of threshold freeze
 * @param inflationRate - Annual CPI rate
 * @returns Extra tax due to fiscal drag
 */
export function computeFiscalDragCost(
  realIncome: number,
  yearsFromNow: number,
  inflationRate: number,
): number {
  // Nominal income grows with inflation
  const nominalIncome = realIncome * Math.pow(1 + inflationRate, yearsFromNow);

  // Tax at frozen thresholds (what HMRC charges)
  const taxFrozen = computeIncomeTax(nominalIncome);

  // Tax if thresholds were indexed (what would be fair)
  // Scale: real income against real PA = same as nominal against indexed PA
  const taxIndexed = computeIncomeTax(realIncome);

  return Math.max(0, taxFrozen - taxIndexed);
}

// =============================================================================
// SIPP Tax-Free Lump Sum
// =============================================================================

/** Maximum tax-free lump sum (Lump Sum Allowance, 2025-26) */
export const LUMP_SUM_ALLOWANCE = 268_275;

/** Tax-free fraction of crystallised pension */
export const TFLS_FRACTION = 0.25;

/**
 * Compute the tax-free lump sum available from a SIPP.
 *
 * 25% of the crystallised amount, capped at the Lump Sum Allowance.
 *
 * @param sippValue - Total SIPP value
 * @param alreadyUsed - LSA already used from previous crystallisations
 * @returns Tax-free amount available
 */
export function computeTFLS(
  sippValue: number,
  alreadyUsed: number = 0,
): number {
  const maxFromFund = sippValue * TFLS_FRACTION;
  const remainingAllowance = Math.max(0, LUMP_SUM_ALLOWANCE - alreadyUsed);
  return Math.min(maxFromFund, remainingAllowance);
}

/**
 * Compute tax on a SIPP withdrawal (UFPLS — Uncrystallised Funds Pension Lump Sum).
 *
 * Each UFPLS withdrawal is 25% tax-free, 75% taxed as income.
 * This is an alternative to taking TFLS upfront.
 *
 * @param withdrawal - Gross UFPLS withdrawal
 * @param otherIncome - Other taxable income in the same year
 * @param lsaRemaining - Remaining Lump Sum Allowance
 * @returns Object with taxFree, taxable, and tax amounts
 */
export function computeUFPLSTax(
  withdrawal: number,
  otherIncome: number,
  lsaRemaining: number = LUMP_SUM_ALLOWANCE,
): { taxFree: number; taxable: number; tax: number; net: number } {
  const potentialTaxFree = withdrawal * TFLS_FRACTION;
  const taxFree = Math.min(potentialTaxFree, lsaRemaining);
  const taxable = withdrawal - taxFree;

  // Tax on the taxable portion at marginal rate given other income
  const taxWithout = computeIncomeTax(otherIncome);
  const taxWith = computeIncomeTax(otherIncome + taxable);
  const tax = taxWith - taxWithout;

  return {
    taxFree,
    taxable,
    tax,
    net: withdrawal - tax,
  };
}
