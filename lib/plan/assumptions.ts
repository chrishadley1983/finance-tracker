/**
 * The app's binding to plan/assumptions.json — the single home for planning
 * numbers. Every value here is read from the JSON through the loader in
 * plan/inputs/assumptions.mjs, which validates provenance and recomputes the
 * DERIVED entries. There are no literals in this file.
 *
 * To change a number: `npm run plan:set -- <key> <value> --source ... --asof ...`
 * (or edit the JSON), then `npm run plan:check`. The cockpit, the engine, the
 * tools and the generated documents all move together.
 */

import assumptionsFile from '../../plan/assumptions.json';
import fallbackPrices from '../../plan/observations/gilt-prices/2026-07-29.json';
import latestAccepted from '../../plan/runs/latest-accepted.json';
import { buildAssumptions } from '../../plan/inputs/assumptions.mjs';

const A = buildAssumptions(assumptionsFile as never).values;

/** The resolved assumption values — what the engine in plan/engine takes as its first argument. */
export const ASSUMPTIONS = A;
export const ASSUMPTIONS_PREPARED_ON: string = assumptionsFile.preparedOn;
export const KNOWN_LIMITATIONS = assumptionsFile.knownLimitations;

/** The last accepted run (plan/runs/latest-accepted.json, written by plan:accept). */
export const LATEST_ACCEPTED: { runId: string | null; acceptedOn?: string; verdict?: string; note?: string; headline?: { atRetirement?: number; atLastRung?: number; atEnd?: number }; avcPct?: number | null; potsTotal?: number; ladderPerYear?: number | null } = latestAccepted;

// Named views kept for readability at the call sites; all values come from A.
export const PAYSLIP = {
  asOf: A.payslip.asOf as string,
  basicAnnual: A.payslip.basicAnnual as number,
  carAllowance: A.payslip.carAllowance as number,
  medicalBik: A.payslip.medicalBik as number,
  bonusRate: A.payslip.bonusRate as number,
  existingEeRate: A.payslip.existingEeRate as number,
  employerRate: A.payslip.employerRate as number,
  payGrowth: A.payslip.payGrowth as number,
} as const;

export const TAX = {
  higherRateFloor: A.tax.higherRateFloor as number,
  reliefAbove: A.tax.reliefAbove as number,
  reliefBelow: A.tax.reliefBelow as number,
  personalAllowance: A.tax.personalAllowance as number,
  basicRate: A.tax.basicRate as number,
  higherRate: A.tax.higherRate as number,
  basicRateBand: A.tax.basicRateBand as number,
  payeAllowance: A.tax.payeAllowance as number,
  niMainRate: A.tax.niMainRate as number,
  niUpperRate: A.tax.niUpperRate as number,
  niPrimaryThreshold: A.tax.niPrimaryThreshold as number,
  niUpperEarningsLimit: A.tax.niUpperEarningsLimit as number,
} as const;

export const HICBC = {
  lowerThreshold: A.hicbc.lowerThreshold as number,
  upperThreshold: A.hicbc.upperThreshold as number,
  taperPerStep: A.hicbc.taperPerStep as number,
  stepSize: A.hicbc.stepSize as number,
  defaultTarget: A.hicbc.operatingTarget as number,
} as const;

export const CHILD_BENEFIT = {
  annual2026: A.childBenefit.annual2026 as number,
  uprating: A.childBenefit.uprating as number,
  emmieEndsAug: A.childBenefit.emmieEndsAug as number,
  maxEndsAug: A.childBenefit.maxEndsAug as number,
} as const;

export const PIVOT_YEARS: number = A.pivot.years;
export const PIVOT_FIRST_TAX_YEAR: number = A.pivot.firstTaxYear;

export const POTS = {
  chrisIiIsa: A.pots.chrisIiIsa as number,
  abbyVanguardIsa: A.pots.abbyVanguardIsa as number,
  chrisIiSipp: A.pots.chrisIiSipp as number,
  chrisAccenturePension: A.pots.chrisAccenturePension as number,
  abbyAccentureDc: A.pots.abbyAccentureDc as number,
  otherSavings: A.pots.otherSavings as number,
  accentureShares: A.pots.accentureShares as number,
  cashBuffer: A.pots.cashBuffer as number,
  crypto: A.pots.crypto as number,
} as const;

/** Pension / non-pension totals, DERIVED in the JSON from the per-account snapshot values. */
export const POTS_BASELINE = {
  chrisPension: A.pots.chrisPension as number,
  abbyPension: A.pots.abbyPension as number,
  nonPension: A.pots.nonPension as number,
} as const;

export const ACCOUNT_BUCKETS: Record<string, 'chrisPension' | 'abbyPension' | 'accessible' | 'excluded'> = A.accounts.bucketMap;

export const SPEND = {
  planLine: A.spend.planLine as number,
  retirementTarget: A.spend.retirementTarget as number,
  excludedCategories: A.spend.excludedCategories as readonly string[],
  nineYearSavingsDrawBudget: A.spend.nineYearSavingsDrawBudget as number,
} as const;

export const INCOME = {
  hbPreRetirement: A.income.hbPreRetirement as number,
  hbPostRetirement: A.income.hbPostRetirement as number,
} as const;

export const DATES = {
  planRetirementYear: A.dates.planRetirementYear as number,
  chrisPensionAccessYear: A.dates.chrisPensionAccessYear as number,
  abbyPensionAccessYear: A.dates.abbyPensionAccessYear as number,
  chrisStatePensionYear: A.dates.chrisStatePensionYear as number,
  abbyStatePensionYear: A.dates.abbyStatePensionYear as number,
  simulationEndYear: A.dates.simulationEndYear as number,
} as const;

export const STATE_PENSION = { annualEach: A.statePension.annualEach as number } as const;
export const DRAWDOWN = { tfcCapEach: A.drawdown.tfcCapEach as number, ufplsTaxableFraction: A.drawdown.ufplsTaxableFraction as number } as const;
export const RETURNS = { realEquityPlanning: A.returns.realEquity.planning as number, realEquityBetter: A.returns.realEquity.better as number, cashReal: A.returns.cashReal as number } as const;

export const LADDER = {
  firstYear: A.ladder.firstYear as number,
  lastYear: A.ladder.lastYear as number,
  budgetReal: A.ladder.budgetReal as number,
  isaBudgetReal: A.ladder.isaBudgetReal as number,
  sippBudgetReal: A.ladder.sippBudgetReal as number,
} as const;

export interface GiltPrice {
  epic: string;
  name: string;
  coupon: string;
  maturity: string; // e.g. "22-Sep-2035"
  matYear: number;
  clean: number;
  dirty: number;
  realYield: number; // %
}

/** Static fallback prices (plan/observations/gilt-prices/2026-07-29.json), used only when the live fetch fails with no cache. */
export const FALLBACK_GILT_PRICES: GiltPrice[] = fallbackPrices.gilts;
export const FALLBACK_GILT_PRICES_AS_OF: string = fallbackPrices.asOf;

/** Chart palette — presentation, not a planning number. */
export const PALETTE = { navy: '#14467d', blue: '#3a6ea5', green: '#2e9d5b', amber: '#c77c1b', grey: '#8a97a8', ink: '#0f2a4a' } as const;
