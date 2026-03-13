/**
 * UK Tax Wrapper Drawdown Optimiser.
 *
 * Computes the optimal annual drawdown from ISA, SIPP, and GIA
 * to minimise lifetime tax. Handles pre/post state pension strategies,
 * TFLS timing, and CGT harvesting.
 *
 * Draw order principle (ERN-adapted for UK):
 *   1. ISA — tax-free, preserves SIPP compounding
 *   2. SIPP — 25% TFLS tax-free, remainder taxed as income
 *      (draw pre-pension to fill PA while it's available)
 *   3. GIA — CGT on gains, use for CGT harvesting
 *   4. Cash — liquidity buffer only
 */

import {
  computeIncomeTax,
  computeCGT,
  getPersonalAllowance,
  computeTFLS,
  PERSONAL_ALLOWANCE,
  TFLS_FRACTION,
  LUMP_SUM_ALLOWANCE,
  CGT_ALLOWANCE,
  TAX_BANDS,
} from './uk-tax';

// =============================================================================
// Types
// =============================================================================

export interface WrapperBalances {
  isa: number;
  sipp: number;
  gia: number;
  cash: number;
}

export interface DrawdownResult {
  /** Amount drawn from each wrapper */
  fromIsa: number;
  fromSipp: number;
  fromSippTaxFree: number;
  fromSippTaxable: number;
  fromGia: number;
  fromCash: number;

  /** Tax breakdown */
  incomeTax: number;
  cgt: number;
  totalTax: number;

  /** Net after tax */
  netIncome: number;

  /** Remaining balances */
  remainingBalances: WrapperBalances;
}

export interface DrawdownConfig {
  /** Annual spending need (in today's money) */
  annualSpend: number;

  /** Current wrapper balances */
  balances: WrapperBalances;

  /** State pension annual income (0 if not yet receiving) */
  statePensionAnnual: number;

  /** Whether state pension is currently being received */
  receivingStatePension: boolean;

  /** Lump Sum Allowance already used */
  lsaUsed?: number;

  /** GIA cost basis as fraction of value (e.g., 0.5 = 50% is gain) */
  giaGainFraction?: number;

  /** Whether to use UFPLS (spread TFLS) vs upfront TFLS */
  useUFPLS?: boolean;
}

// =============================================================================
// Core Optimiser
// =============================================================================

/**
 * Compute optimal single-year drawdown from wrappers.
 *
 * Strategy:
 * - **Pre-pension (no state pension)**: Draw SIPP up to PA (tax-free via PA),
 *   then ISA for the rest. This uses the PA that would otherwise be wasted.
 * - **Post-pension (receiving state pension)**: State pension fills most of PA,
 *   so draw ISA first (tax-free), then SIPP only if ISA insufficient.
 * - **GIA**: Only draw if ISA + SIPP insufficient, harvest gains up to CGT allowance.
 * - **Cash**: Last resort.
 */
export function computeOptimalDrawdown(config: DrawdownConfig): DrawdownResult {
  const {
    annualSpend,
    balances,
    statePensionAnnual,
    receivingStatePension,
    lsaUsed = 0,
    giaGainFraction = 0.5,
    useUFPLS = false,
  } = config;

  // Net spending need after state pension
  const statePensionNet = receivingStatePension ? statePensionAnnual : 0;
  const spendingGap = Math.max(0, annualSpend - statePensionNet);

  let fromIsa = 0;
  let fromSipp = 0;
  let fromSippTaxFree = 0;
  let fromSippTaxable = 0;
  let fromGia = 0;
  let fromCash = 0;
  let remaining = spendingGap;

  if (!receivingStatePension) {
    // PRE-PENSION STRATEGY: Fill PA with SIPP, then ISA

    // Draw SIPP up to personal allowance (taxed at 0% due to PA)
    const paSpace = PERSONAL_ALLOWANCE;
    const sippForPA = Math.min(remaining, paSpace, balances.sipp);

    if (sippForPA > 0) {
      if (useUFPLS) {
        // UFPLS: 25% tax-free, 75% taxable
        const lsaRemaining = Math.max(0, LUMP_SUM_ALLOWANCE - lsaUsed);
        const taxFreePortion = Math.min(sippForPA * TFLS_FRACTION, lsaRemaining);
        fromSippTaxFree = taxFreePortion;
        fromSippTaxable = sippForPA - taxFreePortion;
      } else {
        // Standard: all taxable income but covered by PA
        fromSippTaxable = sippForPA;
      }
      fromSipp = sippForPA;
      remaining -= sippForPA;
    }

    // Rest from ISA (tax-free)
    if (remaining > 0) {
      fromIsa = Math.min(remaining, balances.isa);
      remaining -= fromIsa;
    }
  } else {
    // POST-PENSION STRATEGY: ISA first, then SIPP

    // State pension occupies PA, so SIPP drawdown would be taxed
    // Draw ISA first (entirely tax-free)
    fromIsa = Math.min(remaining, balances.isa);
    remaining -= fromIsa;

    // If ISA insufficient, draw SIPP
    if (remaining > 0) {
      const sippDraw = Math.min(remaining, balances.sipp);
      if (sippDraw > 0) {
        if (useUFPLS) {
          const lsaRemaining = Math.max(0, LUMP_SUM_ALLOWANCE - lsaUsed);
          const taxFreePortion = Math.min(sippDraw * TFLS_FRACTION, lsaRemaining);
          fromSippTaxFree = taxFreePortion;
          fromSippTaxable = sippDraw - taxFreePortion;
        } else {
          fromSippTaxable = sippDraw;
        }
        fromSipp = sippDraw;
        remaining -= sippDraw;
      }
    }
  }

  // GIA if still short
  if (remaining > 0) {
    fromGia = Math.min(remaining, balances.gia);
    remaining -= fromGia;
  }

  // Cash as last resort
  if (remaining > 0) {
    fromCash = Math.min(remaining, balances.cash);
    remaining -= fromCash;
  }

  // Compute taxes
  const totalTaxableIncome = statePensionNet + fromSippTaxable;
  const incomeTax = computeIncomeTax(totalTaxableIncome);

  // CGT on GIA withdrawal (only the gain portion)
  const giaGains = fromGia * giaGainFraction;
  const cgt = computeCGT(giaGains, totalTaxableIncome);

  const totalTax = incomeTax + cgt;

  return {
    fromIsa,
    fromSipp,
    fromSippTaxFree,
    fromSippTaxable,
    fromGia,
    fromCash,
    incomeTax,
    cgt,
    totalTax,
    netIncome: statePensionNet + fromIsa + fromSipp + fromGia + fromCash - totalTax,
    remainingBalances: {
      isa: balances.isa - fromIsa,
      sipp: balances.sipp - fromSipp,
      gia: balances.gia - fromGia,
      cash: balances.cash - fromCash,
    },
  };
}

// =============================================================================
// Multi-Year Projection
// =============================================================================

export interface YearlyDrawdown extends DrawdownResult {
  year: number;
  age: number;
  statePensionIncome: number;
  totalGrossIncome: number;
  effectiveTaxRate: number;
}

export interface DrawdownProjectionConfig {
  /** Starting age */
  currentAge: number;

  /** Age at which state pension starts */
  statePensionAge: number;

  /** Annual state pension (in today's money, triple-locked) */
  statePensionAnnual: number;

  /** Annual spending need (in today's money) */
  annualSpend: number;

  /** Starting wrapper balances */
  balances: WrapperBalances;

  /** Expected real return (after inflation) on each wrapper */
  realReturn: number;

  /** Projection horizon (years) */
  horizonYears: number;

  /** LSA already used */
  lsaUsed?: number;

  /** GIA gain fraction (initial, increases as gains compound) */
  giaGainFraction?: number;

  /** Use UFPLS strategy */
  useUFPLS?: boolean;
}

/**
 * Project drawdown over multiple years.
 *
 * Applies real returns to remaining balances, switches strategy
 * when state pension kicks in, and tracks cumulative tax.
 */
export function projectDrawdown(config: DrawdownProjectionConfig): {
  years: YearlyDrawdown[];
  totalTaxPaid: number;
  totalDrawn: number;
  finalBalances: WrapperBalances;
  depletionAge: number | null;
} {
  const {
    currentAge,
    statePensionAge,
    statePensionAnnual,
    annualSpend,
    realReturn,
    horizonYears,
    lsaUsed: initialLsaUsed = 0,
    giaGainFraction: initialGiaGainFraction = 0.5,
    useUFPLS = false,
  } = config;

  let balances = { ...config.balances };
  let lsaUsed = initialLsaUsed;
  let totalTaxPaid = 0;
  let totalDrawn = 0;
  let depletionAge: number | null = null;
  const years: YearlyDrawdown[] = [];

  for (let y = 0; y < horizonYears; y++) {
    const age = currentAge + y;
    const receivingStatePension = age >= statePensionAge;
    const statePensionIncome = receivingStatePension ? statePensionAnnual : 0;

    // Estimate GIA gain fraction (increases over time as gains compound)
    const giaGainFraction = Math.min(
      0.9,
      initialGiaGainFraction + y * 0.01,
    );

    const result = computeOptimalDrawdown({
      annualSpend,
      balances,
      statePensionAnnual,
      receivingStatePension,
      lsaUsed,
      giaGainFraction,
      useUFPLS,
    });

    // Track LSA usage
    lsaUsed += result.fromSippTaxFree;

    const totalGrossIncome = statePensionIncome + result.fromIsa + result.fromSipp
      + result.fromGia + result.fromCash;
    const effectiveTaxRate = totalGrossIncome > 0
      ? result.totalTax / totalGrossIncome
      : 0;

    years.push({
      ...result,
      year: y,
      age,
      statePensionIncome,
      totalGrossIncome,
      effectiveTaxRate,
    });

    totalTaxPaid += result.totalTax;
    totalDrawn += result.fromIsa + result.fromSipp + result.fromGia + result.fromCash;

    // Update balances with real returns
    balances = {
      isa: result.remainingBalances.isa * (1 + realReturn),
      sipp: result.remainingBalances.sipp * (1 + realReturn),
      gia: result.remainingBalances.gia * (1 + realReturn),
      cash: result.remainingBalances.cash, // Cash earns no real return
    };

    // Check depletion
    const totalBalance = balances.isa + balances.sipp + balances.gia + balances.cash;
    if (totalBalance <= 0 && depletionAge === null) {
      depletionAge = age;
    }
  }

  return {
    years,
    totalTaxPaid,
    totalDrawn,
    finalBalances: balances,
    depletionAge,
  };
}

// =============================================================================
// CGT Harvesting Suggestion
// =============================================================================

/**
 * Compute the optimal GIA gain to realise for CGT harvesting.
 *
 * Suggest realising gains up to the CGT allowance each year
 * to reset cost basis and reduce future CGT liability.
 *
 * @param giaValue - Current GIA value
 * @param giaGainFraction - Fraction of GIA that is gain
 * @param otherIncome - Other taxable income (to determine CGT rate)
 * @returns Suggested gain to realise and the tax cost
 */
export function suggestCGTHarvest(
  giaValue: number,
  giaGainFraction: number,
  otherIncome: number,
): { suggestedGain: number; taxCost: number; sellAmount: number } {
  const totalGain = giaValue * giaGainFraction;
  const suggestedGain = Math.min(totalGain, CGT_ALLOWANCE);

  // Amount to sell to realise this gain
  const sellAmount = giaGainFraction > 0
    ? suggestedGain / giaGainFraction
    : 0;

  // Tax on gains up to allowance = 0
  const taxCost = computeCGT(suggestedGain, otherIncome);

  return { suggestedGain, taxCost, sellAmount };
}
