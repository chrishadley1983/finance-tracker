/**
 * Plan Cockpit constants.
 *
 * Source of truth: Docs/investment-plan-amendment-1-2026-07.md (the July 2026
 * plan) and Abby's April 2026 payslip. Values are in today's (mid-2026) money
 * unless noted. These are plan assumptions, not live data — edit here, not in
 * the UI.
 */

// ---------------------------------------------------------------------------
// Abby's payslip (April 2026) and pivot mechanics
// ---------------------------------------------------------------------------
export const PAYSLIP = {
  basicAnnual: 69_900, // £5,825/mo
  carAllowance: 6_500, // £541.67/mo, not pensionable, assumed flat
  medicalBik: 1_330, // £110.83/mo, taxed via payroll, assumed flat
  bonusRate: 0.05, // of basic; assumed sacrificeable
  existingEeRate: 0.045, // current salary-sacrifice, basic only
  employerRate: 0.11, // Accenture, basic only; no match on AVCs assumed
  payGrowth: 0.02, // per year, basic only
} as const;

export const TAX = {
  higherRateFloor: 50_270, // taxable income above this saves 40% + 2% NI
  reliefAbove: 0.42,
  reliefBelow: 0.28, // 20% tax + 8% NI
  personalAllowance: 12_570,
  basicRate: 0.2,
} as const;

export const HICBC = {
  lowerThreshold: 60_000, // full child benefit below this ANI (frozen)
  upperThreshold: 80_000, // none above this
  taperPerStep: 0.01, // 1% of CB per £200 over
  stepSize: 200,
  defaultTarget: 59_500, // operate £500 under the line
} as const;

export const CHILD_BENEFIT = {
  annual2026: 2_337.4, // £27.05 + £17.90 per week, two children (2026/27)
  uprating: 0.02, // CPI assumption
  // Payable while in full-time education:
  emmieEndsAug: 2035,
  maxEndsAug: 2037,
} as const;

/** Pivot programme years: 2026/27 (index 0) to 2034/35 (index 8). */
export const PIVOT_YEARS = 9;
export const PIVOT_FIRST_TAX_YEAR = 2026; // "2026/27"

// ---------------------------------------------------------------------------
// Pots and buckets (June 2026 verified baseline)
// ---------------------------------------------------------------------------
export const POTS_BASELINE = {
  asOf: '2026-06-09',
  chrisPension: 624_954, // SIPP £434,584 + old Accenture £190,370
  abbyPension: 272_948,
  nonPension: 709_000, // ISAs £581.5k + crypto £54k + cash/NS&I £55k (derived)
} as const;

/**
 * Account-name → bucket mapping for live wealth snapshots.
 * Unlisted accounts fall back by type: pension → (name contains 'abby' ?
 * abbyPension : chrisPension); property/tracking/credit/other → excluded;
 * everything else → accessible.
 */
export const ACCOUNT_BUCKETS: Record<string, 'chrisPension' | 'abbyPension' | 'accessible' | 'excluded'> = {
  'Chris II SIPP Pension': 'chrisPension',
  'Chris Accenture Pens': 'chrisPension',
  'Abby Accenture Pension': 'abbyPension',
  'Abby S&S ISA': 'accessible',
  'CH ISA': 'accessible',
  'Cash Position': 'accessible',
  'Other Savings': 'accessible',
  'HSBC Global Money Account': 'accessible',
  'HSBC Joint Current Account': 'accessible',
  'Accenture Shares': 'accessible',
  'House Net Worth': 'excluded',
  'Investment Contributions': 'excluded',
  'Business Stock': 'excluded',
  'HSBC Credit Card': 'excluded',
};

// ---------------------------------------------------------------------------
// Spending
// ---------------------------------------------------------------------------
export const SPEND = {
  planLine: 69_500, // run-rate the plan holds to 2035
  retirementTarget: 60_000,
  /** Categories excluded from the run-rate (one-offs, business, reimbursed). */
  excludedCategories: ['Home improvement', 'Extension', 'Lego Out', 'Work Travel'] as readonly string[],
  nineYearSavingsDrawBudget: 8_000, // at £25k HB target
} as const;

export const INCOME = {
  hbPreRetirement: 25_000, // take-home target to Jun 2035
  hbPostRetirement: 13_000, // to Nov 2040 (Chris pension access), then 0
  abbyTakeHomeYear1: 43_500, // at £60k ANI target, incl. bonus
} as const;

// ---------------------------------------------------------------------------
// Key dates
// ---------------------------------------------------------------------------
export const DATES = {
  planRetirementYear: 2035, // June 2035
  chrisPensionAccessYear: 2040, // Nov 2040 (age 57)
  abbyPensionAccessYear: 2043, // Aug 2043 (age 57)
  chrisStatePensionYear: 2051, // Nov 2051 (68) — first full tax year 2052
  abbyStatePensionYear: 2054, // Aug 2054 (68) — first full tax year 2055
  simulationEndYear: 2075, // Chris 92
} as const;

export const STATE_PENSION = {
  annualEach: 12_548, // 2026/27 full nSP, real
} as const;

export const DRAWDOWN = {
  tfcCapEach: 268_275, // tax-free cash (LSA), frozen real
  ufplsTaxableFraction: 0.75,
} as const;

// ---------------------------------------------------------------------------
// Gilt ladder
// ---------------------------------------------------------------------------
export const LADDER = {
  firstYear: 2035,
  lastYear: 2045,
  targetPerYearReal: 60_000,
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

/**
 * Static fallback prices captured 2026-07-29 (dividenddata.co.uk).
 * Used only when live fetch fails with no cache (criterion E1).
 */
export const FALLBACK_GILT_PRICES: GiltPrice[] = [
  { epic: 'T33', name: '0 3/4% Index-linked Treasury Gilt 2033', coupon: '0.75%', maturity: '22-Nov-2033', matYear: 2033, clean: 94.86, dirty: 105.966, realYield: 1.494 },
  { epic: 'TRTQ', name: '0 3/4% Index-linked Treasury Gilt 2034', coupon: '0.75%', maturity: '22-Mar-2034', matYear: 2034, clean: 93.81, dirty: 168.198, realYield: 1.613 },
  { epic: 'TR35', name: '1 1/8% Index-linked Treasury Gilt 2035', coupon: '1.125%', maturity: '22-Sep-2035', matYear: 2035, clean: 94.52, dirty: 100.83, realYield: 1.77 },
  { epic: 'TG36', name: '0 1/8% Index-linked Treasury Gilt 2036', coupon: '0.125%', maturity: '22-Nov-2036', matYear: 2036, clean: 83.49, dirty: 133.33, realYield: 1.9 },
  { epic: 'TR37', name: '1 1/8% Index-linked Treasury Gilt 2037', coupon: '1.125%', maturity: '22-Nov-2037', matYear: 2037, clean: 91.17, dirty: 187.62, realYield: 2.0 },
  { epic: 'T38', name: '1 3/4% Index-linked Treasury Gilt 2038', coupon: '1.75%', maturity: '22-Sep-2038', matYear: 2038, clean: 96.47, dirty: 101.39, realYield: 2.08 },
  { epic: 'TG39', name: '0 1/8% Index-linked Treasury Gilt 2039', coupon: '0.125%', maturity: '22-Mar-2039', matYear: 2039, clean: 77.4, dirty: 108.36, realYield: 2.18 },
  { epic: 'TR40', name: '0 5/8% Index-linked Treasury Gilt 2040', coupon: '0.625%', maturity: '22-Mar-2040', matYear: 2040, clean: 81.15, dirty: 156.06, realYield: 2.23 },
  { epic: 'T41', name: '0 1/8% Index-linked Treasury Gilt 2041', coupon: '0.125%', maturity: '10-Aug-2041', matYear: 2041, clean: 72.8, dirty: 108.02, realYield: 2.27 },
  { epic: 'T42A', name: '0 5/8% Index-linked Treasury Gilt 2042', coupon: '0.625%', maturity: '22-Nov-2042', matYear: 2042, clean: 76.9, dirty: 150.49, realYield: 2.34 },
  { epic: 'T44', name: '0 1/8% Index-linked Treasury Gilt 2044', coupon: '0.125%', maturity: '22-Mar-2044', matYear: 2044, clean: 65.62, dirty: 114.83, realYield: 2.44 },
  { epic: 'TR45', name: '0 5/8% Index-linked Treasury Gilt 2045', coupon: '0.625%', maturity: '22-Mar-2045', matYear: 2045, clean: 72.76, dirty: 83.24, realYield: 2.46 },
];

// ---------------------------------------------------------------------------
// Chart palette (matches the July plan document)
// ---------------------------------------------------------------------------
export const PALETTE = {
  navy: '#14467d',
  blue: '#3a6ea5',
  green: '#2e9d5b',
  amber: '#c77c1b',
  grey: '#8a97a8',
  ink: '#0f2a4a',
} as const;
