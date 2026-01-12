/**
 * Maths Planning Calculator
 *
 * Provides calculations for the FIRE Maths Planning tab, replicating
 * the spreadsheet calculations with live app data.
 */

// =============================================================================
// Types
// =============================================================================

export interface MathsPlanningInputs {
  // From app data (read-only)
  currentAge: number;
  dateOfBirth: string | null;
  currentSavings: number;  // Excludes property
  propertyValue: number;

  // Editable parameters
  fireSpend: number;        // Default £55k
  swr: number;              // Default from fire_inputs
  expectedReturn: number;   // Default from fire_inputs
  monthlySavings: number;   // Default from fire_inputs
  coastTargetAge: number;   // Editable, default from target_retirement_age

  // Normal/FAT FIRE targets (editable)
  normalFireSpend: number;  // Default £55k from settings
  fatFireSpend: number;     // Default £65k from settings

  // Coast FI inputs (editable)
  coastCurrentSpend: number;    // Current spend for coast calculation
  coastMonthlySavings: number;  // Monthly savings for coast scenarios

  // Partner inputs (manual)
  partnerSavings: number;
  myPension: number;
  jointSavings: number;
}

export interface ScenarioResult {
  targetAmount: number;
  remaining: number;
  investmentIncome: number;
  compoundingPeriod: number;  // years
  monthsToSave: number;
  yearsToSave: number;
  targetAge: number;
  targetDate: Date;
  postTaxEarningsRequired: number;
}

export interface CoastResult {
  retireAge: number;
  currentSpend: number;
  savingPerMonth: number;
  postTaxEarningsRequired: number;
  portfolioAtCoastAge: number;
  swr: number;
  fireSpendAtCoastAge: number;
}

export interface MathsPlanningResults {
  // Current position
  percentOfTarget: number;
  amountNeeded: number;
  targetRetireDate: Date;

  // Normal vs FAT
  normal: ScenarioResult;  // £55k spend
  fat: ScenarioResult;     // £65k spend

  // Coast analysis
  coastNow: CoastResult;
  coastAfterMinFire: CoastResult;

  // Totals
  totalHouseholdSavings: number;
}

// =============================================================================
// Default Constants
// =============================================================================

export const DEFAULT_NORMAL_FIRE_SPEND = 55000;
export const DEFAULT_FAT_FIRE_SPEND = 65000;

// =============================================================================
// Age Calculation
// =============================================================================

/**
 * Calculate exact age from date of birth
 * Returns age with decimal precision (e.g., 42.17)
 */
export function calculateAgeFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  const now = new Date();

  // Calculate the difference in years with decimal precision
  const ageInMs = now.getTime() - dob.getTime();
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000; // Account for leap years
  const exactAge = ageInMs / msPerYear;

  return exactAge;
}

// =============================================================================
// Core Calculation Functions
// =============================================================================

/**
 * Calculate the FIRE target number (amount needed to retire)
 */
export function calculateTargetAmount(annualSpend: number, swr: number): number {
  if (swr <= 0) return Infinity;
  return annualSpend / (swr / 100);
}

/**
 * Calculate annual investment income from savings
 */
export function calculateInvestmentIncome(savings: number, expectedReturn: number): number {
  return savings * (expectedReturn / 100);
}

/**
 * Calculate months to reach target with compound growth
 * Uses the formula for future value of a series with growth
 *
 * FV = P * (1 + r)^n + PMT * ((1 + r)^n - 1) / r
 * where:
 *   P = principal (current savings)
 *   r = monthly rate
 *   n = number of months
 *   PMT = monthly contribution
 *   FV = target amount
 *
 * Solving for n requires iterative approach or logarithms
 */
export function calculateMonthsToTarget(
  currentSavings: number,
  targetAmount: number,
  monthlySavings: number,
  annualReturn: number
): number {
  // Handle edge cases
  if (currentSavings >= targetAmount) return 0;
  if (monthlySavings <= 0 && annualReturn <= 0) return Infinity;

  const remaining = targetAmount - currentSavings;

  // If no return, simple division
  if (annualReturn <= 0) {
    if (monthlySavings <= 0) return Infinity;
    return remaining / monthlySavings;
  }

  const monthlyRate = annualReturn / 100 / 12;

  // If no contributions, pure compound growth
  if (monthlySavings <= 0) {
    // P * (1 + r)^n = Target
    // n = log(Target/P) / log(1 + r)
    const months = Math.log(targetAmount / currentSavings) / Math.log(1 + monthlyRate);
    return months;
  }

  // With both contributions and growth, use iterative approach
  // This is more accurate than the closed-form solution for monthly compounding
  let balance = currentSavings;
  let months = 0;
  const maxMonths = 1200; // 100 years max

  while (balance < targetAmount && months < maxMonths) {
    balance = balance * (1 + monthlyRate) + monthlySavings;
    months++;
  }

  // Interpolate for fractional month
  if (months > 0 && balance > targetAmount) {
    const prevBalance = (balance - monthlySavings) / (1 + monthlyRate);
    const fraction = (targetAmount - prevBalance) / (balance - prevBalance);
    return months - 1 + fraction;
  }

  return months;
}

/**
 * Calculate portfolio value at a future age with compound growth
 */
export function calculatePortfolioAtAge(
  currentSavings: number,
  currentAge: number,
  targetAge: number,
  monthlySavings: number,
  annualReturn: number
): number {
  if (targetAge <= currentAge) return currentSavings;

  const months = (targetAge - currentAge) * 12;
  const monthlyRate = annualReturn / 100 / 12;

  let balance = currentSavings;
  for (let i = 0; i < months; i++) {
    balance = balance * (1 + monthlyRate) + monthlySavings;
  }

  return balance;
}

/**
 * Calculate post-tax earnings required (rough estimate)
 * Assumes ~20% tax rate for simplicity
 */
export function calculatePostTaxEarningsRequired(annualSpend: number): number {
  // This is a simplified calculation
  // In reality, would need to account for tax bands, NI, etc.
  return annualSpend;  // For now, assume spend = post-tax earnings needed
}

// =============================================================================
// Scenario Calculations
// =============================================================================

/**
 * Calculate results for a specific FIRE spend scenario
 */
export function calculateScenario(
  inputs: MathsPlanningInputs,
  targetSpend: number
): ScenarioResult {
  const targetAmount = calculateTargetAmount(targetSpend, inputs.swr);
  const remaining = Math.max(0, targetAmount - inputs.currentSavings);
  const investmentIncome = calculateInvestmentIncome(inputs.currentSavings, inputs.expectedReturn);

  const monthsToSave = calculateMonthsToTarget(
    inputs.currentSavings,
    targetAmount,
    inputs.monthlySavings,
    inputs.expectedReturn
  );

  const yearsToSave = monthsToSave / 12;
  const compoundingPeriod = yearsToSave;
  const targetAge = inputs.currentAge + yearsToSave;

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + Math.round(monthsToSave));

  const postTaxEarningsRequired = calculatePostTaxEarningsRequired(targetSpend);

  return {
    targetAmount,
    remaining,
    investmentIncome,
    compoundingPeriod,
    monthsToSave,
    yearsToSave,
    targetAge,
    targetDate,
    postTaxEarningsRequired,
  };
}

/**
 * Calculate Coast FI scenario - with optional savings until retire age
 * "Coast Now" means stop aggressive saving, but can still have some savings
 */
export function calculateCoastNow(inputs: MathsPlanningInputs): CoastResult {
  const portfolioAtCoastAge = calculatePortfolioAtAge(
    inputs.currentSavings,
    inputs.currentAge,
    inputs.coastTargetAge,
    inputs.coastMonthlySavings,  // Use editable coast savings
    inputs.expectedReturn
  );

  const fireSpendAtCoastAge = portfolioAtCoastAge * (inputs.swr / 100);

  return {
    retireAge: inputs.coastTargetAge,
    currentSpend: inputs.coastCurrentSpend,
    savingPerMonth: inputs.coastMonthlySavings,
    postTaxEarningsRequired: calculatePostTaxEarningsRequired(inputs.coastCurrentSpend),
    portfolioAtCoastAge,
    swr: inputs.swr,
    fireSpendAtCoastAge,
  };
}

/**
 * Calculate Coast FI after reaching the Target FIRE amount
 *
 * This scenario assumes:
 * 1. Continue saving at monthlySavings rate until hitting the Target FIRE (from Target Calculation)
 * 2. After hitting Target FIRE, continue with coastMonthlySavings until retire age
 */
export function calculateCoastAfterMinFire(inputs: MathsPlanningInputs): CoastResult {
  // Use fireSpend (from Target Calculation) not normalFireSpend (from comparison table)
  const targetFireAmount = calculateTargetAmount(inputs.fireSpend, inputs.swr);

  // Calculate when we hit Target FIRE using main monthly savings rate
  const monthsToTargetFire = calculateMonthsToTarget(
    inputs.currentSavings,
    targetFireAmount,
    inputs.monthlySavings,  // Use main savings rate to reach Target FIRE
    inputs.expectedReturn
  );

  const yearsToTargetFire = monthsToTargetFire / 12;
  const ageAtTargetFire = inputs.currentAge + yearsToTargetFire;

  // If we won't reach Target FIRE before retire age, just project with main savings
  if (ageAtTargetFire >= inputs.coastTargetAge) {
    const portfolioAtCoastAge = calculatePortfolioAtAge(
      inputs.currentSavings,
      inputs.currentAge,
      inputs.coastTargetAge,
      inputs.monthlySavings,  // Keep saving at main rate
      inputs.expectedReturn
    );

    return {
      retireAge: inputs.coastTargetAge,
      currentSpend: inputs.coastCurrentSpend,
      savingPerMonth: inputs.monthlySavings,
      postTaxEarningsRequired: calculatePostTaxEarningsRequired(inputs.coastCurrentSpend),
      portfolioAtCoastAge,
      swr: inputs.swr,
      fireSpendAtCoastAge: portfolioAtCoastAge * (inputs.swr / 100),
    };
  }

  // Phase 1: Grow portfolio with main savings until Target FIRE
  const portfolioAtTargetFire = calculatePortfolioAtAge(
    inputs.currentSavings,
    inputs.currentAge,
    ageAtTargetFire,
    inputs.monthlySavings,
    inputs.expectedReturn
  );

  // Phase 2: After Target FIRE, continue with coast savings until retire age
  const portfolioAtCoastAge = calculatePortfolioAtAge(
    portfolioAtTargetFire,
    ageAtTargetFire,
    inputs.coastTargetAge,
    inputs.coastMonthlySavings,  // Use coast savings rate after hitting Target FIRE
    inputs.expectedReturn
  );

  const fireSpendAtCoastAge = portfolioAtCoastAge * (inputs.swr / 100);

  return {
    retireAge: inputs.coastTargetAge,
    currentSpend: inputs.coastCurrentSpend,
    savingPerMonth: inputs.coastMonthlySavings,  // Show coast savings rate
    postTaxEarningsRequired: calculatePostTaxEarningsRequired(inputs.coastCurrentSpend),
    portfolioAtCoastAge,
    swr: inputs.swr,
    fireSpendAtCoastAge,
  };
}

// =============================================================================
// Main Calculator Function
// =============================================================================

/**
 * Calculate all maths planning results
 */
export function calculateMathsPlanning(inputs: MathsPlanningInputs): MathsPlanningResults {
  // Target calculation (using current fireSpend setting)
  const amountNeeded = calculateTargetAmount(inputs.fireSpend, inputs.swr);
  const percentOfTarget = (inputs.currentSavings / amountNeeded) * 100;

  // Calculate target date based on current settings
  const monthsToTarget = calculateMonthsToTarget(
    inputs.currentSavings,
    amountNeeded,
    inputs.monthlySavings,
    inputs.expectedReturn
  );
  const targetRetireDate = new Date();
  targetRetireDate.setMonth(targetRetireDate.getMonth() + Math.round(monthsToTarget));

  // Normal and FAT scenarios - use dynamic values from inputs
  const normal = calculateScenario(inputs, inputs.normalFireSpend);
  const fat = calculateScenario(inputs, inputs.fatFireSpend);

  // Coast analysis
  const coastNow = calculateCoastNow(inputs);
  const coastAfterMinFire = calculateCoastAfterMinFire(inputs);

  // Total household savings
  const totalHouseholdSavings =
    inputs.currentSavings +
    inputs.partnerSavings +
    inputs.myPension +
    inputs.jointSavings;

  return {
    percentOfTarget,
    amountNeeded,
    targetRetireDate,
    normal,
    fat,
    coastNow,
    coastAfterMinFire,
    totalHouseholdSavings,
  };
}

// =============================================================================
// Formatting Utilities
// =============================================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  if (!isFinite(amount)) return '---';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 2): string {
  if (!isFinite(value)) return '---';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format years for display
 */
export function formatYears(years: number, decimals: number = 2): string {
  if (!isFinite(years)) return '---';
  return `${years.toFixed(decimals)} yrs`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
