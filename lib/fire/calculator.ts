import type {
  FireScenario,
  FireInputs,
  FireProjection,
  FireResult,
  FiStatus,
} from '@/lib/types/fire';

/**
 * Calculate the FI target number (amount needed to retire)
 */
export function calculateTargetNumber(
  annualSpend: number,
  withdrawalRate: number
): number {
  return annualSpend / (withdrawalRate / 100);
}

/**
 * Adjust an amount for inflation over a number of years
 */
export function adjustForInflation(
  amount: number,
  years: number,
  inflationRate: number
): number {
  return amount * Math.pow(1 + inflationRate / 100, years);
}

/**
 * Calculate safe withdrawal amount from a portfolio
 */
export function calculateSafeWithdrawal(
  portfolioValue: number,
  withdrawalRate: number
): number {
  return portfolioValue * (withdrawalRate / 100);
}

/**
 * Calculate Coast FI - the amount that will grow to target by retirement age
 * Returns null if already past coast FI or inputs are invalid
 */
export function calculateCoastFi(
  currentValue: number,
  targetNumber: number,
  expectedReturn: number,
  currentAge: number,
  retirementAge: number
): { coastFiAge: number; coastFiNumber: number } | null {
  if (retirementAge <= currentAge) {
    return null;
  }

  const yearsToRetirement = retirementAge - currentAge;
  const annualReturn = expectedReturn / 100;

  // Coast FI number = target / (1 + return)^years
  // This is the amount that, if you stop contributing now, will grow to target
  const coastFiNumber = targetNumber / Math.pow(1 + annualReturn, yearsToRetirement);

  // If current value exceeds coast number, we've already reached Coast FI
  if (currentValue >= coastFiNumber) {
    // Find at what age we reached coast FI (working backwards)
    // We need: currentValue * (1 + return)^years >= target
    // Solve for years: years >= log(target/currentValue) / log(1 + return)
    const yearsFromNowToFi = Math.log(targetNumber / currentValue) / Math.log(1 + annualReturn);
    const coastAge = Math.max(currentAge, Math.ceil(currentAge - (yearsToRetirement - yearsFromNowToFi)));

    return {
      coastFiAge: Math.min(coastAge, currentAge), // Already reached
      coastFiNumber,
    };
  }

  // Calculate what age we'll reach coast FI assuming no more contributions
  // We can't reach it without contributions if current < coastNumber
  return {
    coastFiAge: retirementAge, // Won't reach Coast FI before retirement
    coastFiNumber,
  };
}

/**
 * Main FIRE projection calculation
 */
export function calculateFireProjection(
  inputs: FireInputs,
  scenario: FireScenario,
  yearsToProject: number = 60
): FireResult {
  const currentYear = new Date().getFullYear();
  const projections: FireProjection[] = [];

  const portfolioValue = inputs.currentPortfolioValue || 0;
  const annualSavings = inputs.annualSavings || 0;
  const retirementAge = inputs.targetRetirementAge || scenario.retirementAge || 65;
  const targetNumber = calculateTargetNumber(scenario.annualSpend, scenario.withdrawalRate);

  let currentPortfolio = portfolioValue;
  let fiAge: number | null = null;
  let fiYear: number | null = null;
  let hasReachedFi = false;
  let successfulYears = 0;

  // Calculate Coast FI
  const coastFiResult = calculateCoastFi(
    portfolioValue,
    targetNumber,
    scenario.expectedReturn,
    inputs.currentAge,
    retirementAge
  );

  for (let i = 0; i < yearsToProject; i++) {
    const age = inputs.currentAge + i;
    const year = currentYear + i;
    const yearsFromStart = i;

    const portfolioStart = currentPortfolio;
    const isRetired = age >= retirementAge;

    // Annual spend adjusted for inflation
    const annualSpendInflated = adjustForInflation(
      scenario.annualSpend,
      yearsFromStart,
      scenario.inflationRate
    );

    // Contributions (only if not retired)
    const contributions = isRetired ? 0 : annualSavings;

    // Growth on starting balance + half of contributions (mid-year average)
    const growthBase = portfolioStart + (contributions / 2);
    const growth = growthBase * (scenario.expectedReturn / 100);

    // State pension (only if retired and past state pension age)
    let statePension = 0;
    if (isRetired && age >= scenario.statePensionAge && inputs.includeStatePension) {
      statePension = scenario.statePensionAnnual;
      if (inputs.partnerStatePension) {
        statePension *= 2;
      }
    }

    // Withdrawals (only if retired)
    let withdrawals = 0;
    if (isRetired) {
      // Need to cover inflation-adjusted spend minus state pension
      const spendNeeded = Math.max(0, annualSpendInflated - statePension);
      withdrawals = spendNeeded;
    }

    // End of year portfolio
    const portfolioEnd = Math.max(0, portfolioStart + contributions + growth - withdrawals);

    // Determine FI status
    let fiStatus: FiStatus = 'accumulating';
    if (portfolioEnd <= 0 && isRetired) {
      fiStatus = 'depleted';
    } else if (isRetired) {
      fiStatus = 'retired';
      successfulYears++;
    } else if (portfolioEnd >= targetNumber && !hasReachedFi) {
      fiStatus = 'fi_reached';
      hasReachedFi = true;
      fiAge = age;
      fiYear = year;
    } else if (hasReachedFi) {
      fiStatus = 'fi_reached';
    }

    projections.push({
      age,
      year,
      portfolioStart,
      contributions,
      growth,
      withdrawals,
      statePension,
      portfolioEnd,
      annualSpendInflated,
      fiStatus,
    });

    currentPortfolio = portfolioEnd;

    // Stop if portfolio depleted in retirement
    if (portfolioEnd <= 0 && isRetired) {
      break;
    }
  }

  // Calculate success rate (% of retirement years where portfolio survives)
  const retiredYears = projections.filter(p => p.age >= retirementAge).length;
  const successRate = retiredYears > 0 ? (successfulYears / retiredYears) * 100 : 100;

  return {
    scenario,
    inputs,
    projections,
    fiAge,
    fiYear,
    coastFiAge: coastFiResult?.coastFiAge ?? null,
    coastFiNumber: coastFiResult?.coastFiNumber ?? null,
    targetNumber,
    yearsToFi: fiAge !== null ? fiAge - inputs.currentAge : null,
    successRate,
  };
}

/**
 * Calculate projections for multiple scenarios
 */
export function calculateMultipleScenarios(
  inputs: FireInputs,
  scenarios: FireScenario[]
): FireResult[] {
  return scenarios.map(scenario => calculateFireProjection(inputs, scenario));
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
