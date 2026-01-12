/**
 * Historical Simulation Engine
 *
 * Runs retirement simulations across all historical periods to determine
 * success rates and outcome distributions.
 */

import {
  getValidStartYears,
  getReturnsForRange,
} from './data/historical-returns';
import type {
  SimulationConfig,
  SimulationResult,
  YearlySimulationData,
  HistoricalSimulationResults,
  PercentileValues,
  PercentileChartPoint,
  ExtraIncomeSource,
  WithdrawalStrategy,
} from '@/lib/types/fire';

/**
 * Calculate the weighted portfolio return based on stock/bond allocation
 */
export function calculatePortfolioReturn(
  stockAllocation: number,
  bondAllocation: number,
  stockReturn: number,
  bondReturn: number
): number {
  const stockWeight = stockAllocation / 100;
  const bondWeight = bondAllocation / 100;
  return stockWeight * stockReturn + bondWeight * bondReturn;
}

/**
 * Calculate withdrawal amount based on strategy
 */
export function calculateWithdrawal(
  strategy: WithdrawalStrategy,
  currentPortfolio: number,
  initialWithdrawal: number,
  withdrawalRate: number,
  _yearIndex: number,
  _cumulativeInflation: number
): number {
  switch (strategy) {
    case 'constant_dollar':
      // Fixed initial amount - same real value each year
      // The withdrawal is already in real terms, so no inflation adjustment needed
      // when using real returns
      return initialWithdrawal;

    case 'percent_of_portfolio':
      // Fixed percentage of current portfolio value
      return currentPortfolio * (withdrawalRate / 100);

    default:
      return initialWithdrawal;
  }
}

/**
 * Calculate extra income for a given age
 */
export function calculateExtraIncome(
  sources: ExtraIncomeSource[],
  age: number,
  cumulativeInflation: number
): number {
  return sources.reduce((total, source) => {
    // Check if income is active at this age
    const isActive = age >= source.startAge &&
      (source.endAge === undefined || age <= source.endAge);

    if (!isActive) return total;

    // Apply inflation adjustment if needed
    // Note: When using real returns, we typically keep income in real terms
    const amount = source.adjustForInflation
      ? source.annualAmount
      : source.annualAmount / (1 + cumulativeInflation);

    return total + amount;
  }, 0);
}

/**
 * Run a single simulation for a specific starting year
 */
export function runSingleSimulation(
  startYear: number,
  config: SimulationConfig
): SimulationResult | null {
  const returns = getReturnsForRange(startYear, config.retirementDuration);

  // Not enough data for this simulation
  if (returns.length < config.retirementDuration) {
    return null;
  }

  const {
    initialPortfolio,
    stockAllocation,
    bondAllocation,
    withdrawalStrategy,
    initialWithdrawalRate,
    initialWithdrawalAmount,
    extraIncome,
    currentAge,
    retirementDuration,
  } = config;

  // Calculate initial withdrawal amount
  const initialWithdrawal = initialWithdrawalAmount !== undefined
    ? initialWithdrawalAmount
    : initialPortfolio * (initialWithdrawalRate / 100);

  let portfolio = initialPortfolio;
  let cumulativeInflation = 0;
  let minimumPortfolio = initialPortfolio;
  let minimumYear = startYear;
  let totalWithdrawals = 0;
  let failureYear: number | undefined;

  const yearlyData: YearlySimulationData[] = [];

  for (let yearIndex = 0; yearIndex < retirementDuration; yearIndex++) {
    const year = startYear + yearIndex;
    const age = currentAge + yearIndex;
    const yearReturns = returns[yearIndex];

    const portfolioStart = portfolio;

    // Calculate withdrawal for this year
    const withdrawal = calculateWithdrawal(
      withdrawalStrategy,
      portfolio,
      initialWithdrawal,
      initialWithdrawalRate,
      yearIndex,
      cumulativeInflation
    );

    // Calculate extra income (pension, etc.)
    const extraIncomeAmount = calculateExtraIncome(extraIncome, age, cumulativeInflation);

    // Net withdrawal from portfolio
    const netWithdrawal = Math.max(0, withdrawal - extraIncomeAmount);

    // Withdraw from portfolio (at start of year)
    portfolio = portfolio - netWithdrawal;

    // Check for failure (can't meet withdrawal)
    if (portfolio < 0) {
      portfolio = 0;
      failureYear = year;

      // Record this year's data before breaking
      yearlyData.push({
        year,
        yearIndex,
        age,
        portfolioStart,
        withdrawal,
        extraIncome: extraIncomeAmount,
        netWithdrawal,
        stockReturn: yearReturns.realStocks,
        bondReturn: yearReturns.realBonds,
        portfolioReturn: 0,
        portfolioEnd: 0,
        cumulativeInflation,
      });

      break;
    }

    // Apply returns (using real returns - already inflation adjusted)
    const portfolioReturn = calculatePortfolioReturn(
      stockAllocation,
      bondAllocation,
      yearReturns.realStocks,
      yearReturns.realBonds
    );

    portfolio = portfolio * (1 + portfolioReturn);
    totalWithdrawals += withdrawal;

    // Track cumulative inflation (for reference)
    cumulativeInflation = (1 + cumulativeInflation) * (1 + yearReturns.inflation) - 1;

    // Track minimum portfolio value
    if (portfolio < minimumPortfolio) {
      minimumPortfolio = portfolio;
      minimumYear = year;
    }

    yearlyData.push({
      year,
      yearIndex,
      age,
      portfolioStart,
      withdrawal,
      extraIncome: extraIncomeAmount,
      netWithdrawal,
      stockReturn: yearReturns.realStocks,
      bondReturn: yearReturns.realBonds,
      portfolioReturn,
      portfolioEnd: portfolio,
      cumulativeInflation,
    });
  }

  const yearsLasted = failureYear
    ? failureYear - startYear
    : retirementDuration;

  // Calculate real final portfolio value (in start-year dollars)
  const finalInflationFactor = yearlyData.length > 0
    ? 1 + yearlyData[yearlyData.length - 1].cumulativeInflation
    : 1;

  return {
    startYear,
    endYear: startYear + retirementDuration - 1,
    success: failureYear === undefined,
    failureYear,
    yearsLasted,
    finalPortfolioValue: portfolio,
    finalPortfolioReal: portfolio / finalInflationFactor,
    minimumPortfolioValue: minimumPortfolio,
    minimumPortfolioYear: minimumYear,
    totalWithdrawals,
    averageAnnualWithdrawal: totalWithdrawals / yearsLasted,
    yearlyData,
  };
}

/**
 * Calculate percentile value from a sorted array
 */
function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

/**
 * Calculate percentile values for a distribution
 */
function calculatePercentiles(values: number[]): PercentileValues {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: getPercentile(sorted, 10),
    p25: getPercentile(sorted, 25),
    p50: getPercentile(sorted, 50),
    p75: getPercentile(sorted, 75),
    p90: getPercentile(sorted, 90),
  };
}

/**
 * Calculate percentiles by year for fan chart visualization
 */
function calculatePercentilesByYear(
  simulations: SimulationResult[],
  duration: number
): PercentileChartPoint[] {
  const points: PercentileChartPoint[] = [];

  for (let yearIndex = 0; yearIndex < duration; yearIndex++) {
    const portfolioValues: number[] = [];

    for (const sim of simulations) {
      if (sim.yearlyData[yearIndex]) {
        portfolioValues.push(sim.yearlyData[yearIndex].portfolioEnd);
      }
    }

    if (portfolioValues.length > 0) {
      const percentiles = calculatePercentiles(portfolioValues);
      points.push({
        yearIndex,
        ...percentiles,
      });
    }
  }

  return points;
}

/**
 * Run historical simulations across all valid starting years
 */
export function runHistoricalSimulations(
  config: SimulationConfig
): HistoricalSimulationResults {
  const validStartYears = getValidStartYears(config.retirementDuration);
  const simulations: SimulationResult[] = [];

  // Run simulation for each starting year
  for (const startYear of validStartYears) {
    const result = runSingleSimulation(startYear, config);
    if (result) {
      simulations.push(result);
    }
  }

  // Calculate aggregate statistics
  const successfulSims = simulations.filter(s => s.success);
  const failedSims = simulations.filter(s => !s.success);

  const totalSimulations = simulations.length;
  const successfulSimulations = successfulSims.length;
  const failedSimulations = failedSims.length;
  const successRate = totalSimulations > 0
    ? (successfulSimulations / totalSimulations) * 100
    : 0;

  // Final portfolio statistics (from successful simulations)
  const finalPortfolios = successfulSims.map(s => s.finalPortfolioValue);
  const sortedFinalPortfolios = [...finalPortfolios].sort((a, b) => a - b);
  const medianFinalPortfolio = getPercentile(sortedFinalPortfolios, 50);
  const meanFinalPortfolio = finalPortfolios.length > 0
    ? finalPortfolios.reduce((a, b) => a + b, 0) / finalPortfolios.length
    : 0;
  const finalPortfolioPercentiles = calculatePercentiles(finalPortfolios);

  // Withdrawal statistics
  const avgWithdrawals = simulations.map(s => s.averageAnnualWithdrawal);
  const medianAnnualWithdrawal = getPercentile([...avgWithdrawals].sort((a, b) => a - b), 50);
  const withdrawalPercentiles = calculatePercentiles(avgWithdrawals);

  // Failure details
  const failures = failedSims.map(s => ({
    startYear: s.startYear,
    failureYear: s.failureYear!,
    yearsLasted: s.yearsLasted,
  }));

  // Find worst and best cases
  const sortedByYearsLasted = [...simulations].sort((a, b) => {
    // First by years lasted, then by final value
    if (a.yearsLasted !== b.yearsLasted) {
      return a.yearsLasted - b.yearsLasted;
    }
    return a.finalPortfolioValue - b.finalPortfolioValue;
  });

  const worstSim = sortedByYearsLasted[0];
  const bestSim = [...simulations].sort((a, b) =>
    b.finalPortfolioValue - a.finalPortfolioValue
  )[0];

  const worstCase = worstSim ? {
    startYear: worstSim.startYear,
    yearsLasted: worstSim.yearsLasted,
    finalValue: worstSim.finalPortfolioValue,
  } : { startYear: 0, yearsLasted: 0, finalValue: 0 };

  const bestCase = bestSim ? {
    startYear: bestSim.startYear,
    finalValue: bestSim.finalPortfolioValue,
  } : { startYear: 0, finalValue: 0 };

  // Find smallest final portfolio (worst successful simulation by final value)
  const sortedByFinalValue = [...simulations].sort((a, b) =>
    a.finalPortfolioValue - b.finalPortfolioValue
  );
  const smallestFinalSim = sortedByFinalValue[0];
  const smallestFinalPortfolio = smallestFinalSim ? {
    startYear: smallestFinalSim.startYear,
    finalValue: smallestFinalSim.finalPortfolioValue,
  } : { startYear: 0, finalValue: 0 };

  // Calculate percentiles by year for fan chart
  const percentilesByYear = calculatePercentilesByYear(simulations, config.retirementDuration);

  return {
    config,
    simulations,
    totalSimulations,
    successfulSimulations,
    failedSimulations,
    successRate,
    medianFinalPortfolio,
    meanFinalPortfolio,
    finalPortfolioPercentiles,
    medianAnnualWithdrawal,
    withdrawalPercentiles,
    failures,
    worstCase,
    bestCase,
    smallestFinalPortfolio,
    percentilesByYear,
  };
}

/**
 * Get a default simulation configuration
 */
export function getDefaultSimulationConfig(
  initialPortfolio: number,
  currentAge: number
): SimulationConfig {
  return {
    retirementDuration: 30,
    stockAllocation: 75,
    bondAllocation: 25,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawalRate: 4,
    initialPortfolio,
    extraIncome: [],
    currentAge,
  };
}

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
export function formatPercent(value: number, decimals: number = 1): string {
  if (!isFinite(value)) return '---';
  return `${value.toFixed(decimals)}%`;
}
