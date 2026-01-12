import { describe, it, expect } from 'vitest';
import {
  runHistoricalSimulations,
  runSingleSimulation,
  calculatePortfolioReturn,
  calculateWithdrawal,
  getDefaultSimulationConfig,
} from '@/lib/fire/historical-simulator';
import {
  historicalReturns,
  getDataRange,
  getValidStartYears,
  getAvailableSimulationCount,
} from '@/lib/fire/data/historical-returns';
import type { SimulationConfig } from '@/lib/types/fire';

describe('Historical Returns Data', () => {
  it('should have data from 1928 to 2024', () => {
    const range = getDataRange();
    expect(range.firstYear).toBe(1928);
    expect(range.lastYear).toBe(2024);
  });

  it('should have 97 years of data', () => {
    expect(historicalReturns.length).toBe(97);
  });

  it('should have all required fields for each year', () => {
    historicalReturns.forEach((year) => {
      expect(year.year).toBeDefined();
      expect(typeof year.stocks).toBe('number');
      expect(typeof year.bonds).toBe('number');
      expect(typeof year.inflation).toBe('number');
      expect(typeof year.realStocks).toBe('number');
      expect(typeof year.realBonds).toBe('number');
    });
  });

  it('should calculate valid start years for 30-year retirement', () => {
    const validYears = getValidStartYears(30);
    // 1928 to 1995 (1928 + 30 - 1 = 1957, then 1995 + 30 - 1 = 2024)
    expect(validYears[0]).toBe(1928);
    expect(validYears[validYears.length - 1]).toBe(1995);
  });

  it('should calculate simulation count correctly', () => {
    const count30 = getAvailableSimulationCount(30);
    expect(count30).toBe(68); // 1928-1995 = 68 years
  });
});

describe('Portfolio Return Calculation', () => {
  it('should calculate 100% stock allocation correctly', () => {
    const result = calculatePortfolioReturn(100, 0, 0.10, 0.05);
    expect(result).toBeCloseTo(0.10, 5);
  });

  it('should calculate 100% bond allocation correctly', () => {
    const result = calculatePortfolioReturn(0, 100, 0.10, 0.05);
    expect(result).toBeCloseTo(0.05, 5);
  });

  it('should calculate 60/40 allocation correctly', () => {
    const result = calculatePortfolioReturn(60, 40, 0.10, 0.05);
    // 0.6 * 0.10 + 0.4 * 0.05 = 0.06 + 0.02 = 0.08
    expect(result).toBeCloseTo(0.08, 5);
  });
});

describe('Withdrawal Calculation', () => {
  it('should calculate constant dollar withdrawal correctly', () => {
    const withdrawal = calculateWithdrawal(
      'constant_dollar',
      1000000, // current portfolio
      40000,   // initial withdrawal
      4,       // rate
      5,       // year index
      0.1      // cumulative inflation
    );
    expect(withdrawal).toBe(40000);
  });

  it('should calculate percent of portfolio withdrawal correctly', () => {
    const withdrawal = calculateWithdrawal(
      'percent_of_portfolio',
      1200000, // current portfolio
      40000,   // initial withdrawal (ignored)
      4,       // rate
      5,       // year index
      0.1      // cumulative inflation
    );
    expect(withdrawal).toBe(48000); // 4% of 1,200,000
  });
});

describe('Single Simulation', () => {
  const baseConfig: SimulationConfig = {
    retirementDuration: 30,
    stockAllocation: 75,
    bondAllocation: 25,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawalRate: 4,
    initialPortfolio: 1000000,
    extraIncome: [],
    currentAge: 65,
  };

  it('should run a single simulation successfully', () => {
    const result = runSingleSimulation(1950, baseConfig);
    expect(result).not.toBeNull();
    expect(result!.startYear).toBe(1950);
    expect(result!.endYear).toBe(1979);
    expect(result!.yearsLasted).toBeLessThanOrEqual(30);
    expect(result!.yearlyData.length).toBeLessThanOrEqual(30);
  });

  it('should return null for invalid start year', () => {
    const result = runSingleSimulation(2010, baseConfig); // Not enough years
    expect(result).toBeNull();
  });

  it('should track portfolio correctly', () => {
    const result = runSingleSimulation(1950, baseConfig);
    expect(result).not.toBeNull();

    // First year should start with initial portfolio
    expect(result!.yearlyData[0].portfolioStart).toBe(1000000);

    // Each year should have valid data
    result!.yearlyData.forEach((year, index) => {
      expect(year.yearIndex).toBe(index);
      expect(year.age).toBe(65 + index);
      expect(year.portfolioEnd).toBeGreaterThanOrEqual(0);
    });
  });

  it('should include extra income in calculations', () => {
    const configWithPension: SimulationConfig = {
      ...baseConfig,
      extraIncome: [{
        name: 'State Pension',
        annualAmount: 10000,
        startAge: 67,
        adjustForInflation: true,
      }],
    };

    const result = runSingleSimulation(1950, configWithPension);
    expect(result).not.toBeNull();

    // Year 0 (age 65) - no pension
    expect(result!.yearlyData[0].extraIncome).toBe(0);
    expect(result!.yearlyData[0].netWithdrawal).toBe(40000);

    // Year 2 (age 67) - pension starts
    expect(result!.yearlyData[2].extraIncome).toBe(10000);
    expect(result!.yearlyData[2].netWithdrawal).toBe(30000); // 40000 - 10000
  });
});

describe('Historical Simulations', () => {
  const baseConfig: SimulationConfig = {
    retirementDuration: 30,
    stockAllocation: 75,
    bondAllocation: 25,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawalRate: 4,
    initialPortfolio: 1000000,
    extraIncome: [],
    currentAge: 65,
  };

  it('should run all historical simulations', () => {
    const results = runHistoricalSimulations(baseConfig);

    expect(results.totalSimulations).toBeGreaterThan(0);
    expect(results.simulations.length).toBe(results.totalSimulations);
    expect(results.successRate).toBeGreaterThanOrEqual(0);
    expect(results.successRate).toBeLessThanOrEqual(100);
  });

  it('should calculate success rate correctly', () => {
    const results = runHistoricalSimulations(baseConfig);

    const expectedSuccessRate =
      (results.successfulSimulations / results.totalSimulations) * 100;

    expect(results.successRate).toBeCloseTo(expectedSuccessRate, 1);
    expect(results.successfulSimulations + results.failedSimulations)
      .toBe(results.totalSimulations);
  });

  it('should have higher success rate with lower withdrawal rate', () => {
    const lowWRConfig = { ...baseConfig, initialWithdrawalRate: 3 };
    const highWRConfig = { ...baseConfig, initialWithdrawalRate: 6 };

    const lowResults = runHistoricalSimulations(lowWRConfig);
    const highResults = runHistoricalSimulations(highWRConfig);

    expect(lowResults.successRate).toBeGreaterThan(highResults.successRate);
  });

  it('should calculate percentiles correctly', () => {
    const results = runHistoricalSimulations(baseConfig);

    // Percentiles should be in order
    expect(results.finalPortfolioPercentiles.p10)
      .toBeLessThanOrEqual(results.finalPortfolioPercentiles.p25);
    expect(results.finalPortfolioPercentiles.p25)
      .toBeLessThanOrEqual(results.finalPortfolioPercentiles.p50);
    expect(results.finalPortfolioPercentiles.p50)
      .toBeLessThanOrEqual(results.finalPortfolioPercentiles.p75);
    expect(results.finalPortfolioPercentiles.p75)
      .toBeLessThanOrEqual(results.finalPortfolioPercentiles.p90);
  });

  it('should generate percentiles by year for charting', () => {
    const results = runHistoricalSimulations(baseConfig);

    expect(results.percentilesByYear.length).toBeGreaterThan(0);
    expect(results.percentilesByYear.length).toBeLessThanOrEqual(30);

    results.percentilesByYear.forEach((point) => {
      expect(point.p10).toBeLessThanOrEqual(point.p25);
      expect(point.p25).toBeLessThanOrEqual(point.p50);
      expect(point.p50).toBeLessThanOrEqual(point.p75);
      expect(point.p75).toBeLessThanOrEqual(point.p90);
    });
  });
});

describe('Default Configuration', () => {
  it('should create a valid default config', () => {
    const config = getDefaultSimulationConfig(1000000, 65);

    expect(config.initialPortfolio).toBe(1000000);
    expect(config.currentAge).toBe(65);
    expect(config.retirementDuration).toBe(30);
    expect(config.stockAllocation + config.bondAllocation).toBe(100);
    expect(config.withdrawalStrategy).toBe('constant_dollar');
    expect(config.initialWithdrawalRate).toBe(4);
  });
});

describe('Known Historical Results (Validation)', () => {
  it('should match expected 4% rule success rate (approximately 95%)', () => {
    const config: SimulationConfig = {
      retirementDuration: 30,
      stockAllocation: 50,
      bondAllocation: 50,
      withdrawalStrategy: 'constant_dollar',
      initialWithdrawalRate: 4,
      initialPortfolio: 1000000,
      extraIncome: [],
      currentAge: 65,
    };

    const results = runHistoricalSimulations(config);

    // Classic 4% rule with 50/50 allocation should have ~95% success
    // Allow some variance due to data differences
    expect(results.successRate).toBeGreaterThan(85);
    expect(results.successRate).toBeLessThan(100);
  });

  it('should have 100% success rate with very low withdrawal', () => {
    const config: SimulationConfig = {
      retirementDuration: 30,
      stockAllocation: 75,
      bondAllocation: 25,
      withdrawalStrategy: 'constant_dollar',
      initialWithdrawalRate: 2,
      initialPortfolio: 1000000,
      extraIncome: [],
      currentAge: 65,
    };

    const results = runHistoricalSimulations(config);
    expect(results.successRate).toBe(100);
  });
});
