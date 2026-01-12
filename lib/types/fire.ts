import { z } from 'zod';

// =============================================================================
// FIRE Scenario Types
// =============================================================================

export interface FireScenario {
  id: string;
  name: string;
  description: string | null;
  annualSpend: number;
  withdrawalRate: number;
  expectedReturn: number;
  inflationRate: number;
  retirementAge: number | null;
  statePensionAge: number;
  statePensionAnnual: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FireInputs {
  id: string;
  currentAge: number;
  dateOfBirth: string | null;
  targetRetirementAge: number | null;
  currentPortfolioValue: number | null;
  annualIncome: number | null;
  annualSavings: number | null;
  annualSpend: number;
  withdrawalRate: number;
  expectedReturn: number;
  includeStatePension: boolean;
  partnerStatePension: boolean;
  excludePropertyFromFire: boolean;
  normalFireSpend: number;
  fatFireSpend: number;
  updatedAt: string;
}

// =============================================================================
// FIRE Projection Types
// =============================================================================

export type FiStatus = 'accumulating' | 'fi_reached' | 'retired' | 'depleted';

export interface FireProjection {
  age: number;
  year: number;
  portfolioStart: number;
  contributions: number;
  growth: number;
  withdrawals: number;
  statePension: number;
  portfolioEnd: number;
  annualSpendInflated: number;
  fiStatus: FiStatus;
}

export interface FireResult {
  scenario: FireScenario;
  inputs: FireInputs;
  projections: FireProjection[];
  fiAge: number | null;
  fiYear: number | null;
  coastFiAge: number | null;
  coastFiNumber: number | null;
  targetNumber: number;
  yearsToFi: number | null;
  successRate: number;
}

// =============================================================================
// Wealth Types
// =============================================================================

export interface WealthSnapshot {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  accountType: string;
  balance: number;
  notes: string | null;
}

export interface NetWorthSummary {
  date: string;
  total: number;
  previousTotal: number | null;
  change: number | null;
  changePercent: number | null;
  byType: { type: string; label: string; total: number }[];
  byAccount: {
    accountId: string;
    accountName: string;
    accountType: string;
    balance: number;
  }[];
}

export interface NetWorthHistoryPoint {
  date: string;
  total: number;
  byType: Record<string, number>;
}

export interface NetWorthHistory {
  snapshots: NetWorthHistoryPoint[];
  earliest: string | null;
  latest: string | null;
}

// =============================================================================
// Zod Schemas
// =============================================================================

export const createFireScenarioSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(200).optional(),
  annualSpend: z.number().positive('Annual spend must be positive'),
  withdrawalRate: z.number().min(1).max(10).default(4),
  expectedReturn: z.number().min(0).max(20).default(7),
  inflationRate: z.number().min(0).max(10).default(2.5),
  retirementAge: z.number().int().min(30).max(100).optional(),
  statePensionAge: z.number().int().min(60).max(75).default(67),
  statePensionAnnual: z.number().min(0).default(11500),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updateFireScenarioSchema = createFireScenarioSchema.partial();

export const fireInputsSchema = z.object({
  currentAge: z.number().int().min(18).max(100),
  dateOfBirth: z.string().nullable().optional(),
  targetRetirementAge: z.number().int().min(30).max(100).optional().nullable(),
  currentPortfolioValue: z.number().min(0).optional().nullable(),
  annualIncome: z.number().min(0).optional().nullable(),
  annualSavings: z.number().optional().nullable(),
  annualSpend: z.number().positive().default(50000),
  withdrawalRate: z.number().min(1).max(10).default(4),
  expectedReturn: z.number().min(0).max(20).default(7),
  includeStatePension: z.boolean().default(true),
  partnerStatePension: z.boolean().default(false),
  excludePropertyFromFire: z.boolean().default(true),
  normalFireSpend: z.number().positive().default(55000),
  fatFireSpend: z.number().positive().default(65000),
});

export const calculateFireRequestSchema = z.object({
  scenarioIds: z.array(z.string().uuid()).optional(),
  inputOverrides: fireInputsSchema.partial().optional(),
});

// =============================================================================
// Helper Constants
// =============================================================================

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  current: 'Current Accounts',
  savings: 'Savings',
  isa: 'ISAs',
  pension: 'Pensions',
  investment: 'Investments',
  property: 'Property',
};

// =============================================================================
// Maths Planning Types
// =============================================================================

export interface MathsPlanningInputs {
  // From app data (read-only)
  currentAge: number;
  dateOfBirth: string | null;
  currentSavings: number;
  propertyValue: number;

  // Editable parameters
  fireSpend: number;
  swr: number;
  expectedReturn: number;
  monthlySavings: number;
  coastTargetAge: number;

  // Normal/FAT FIRE targets (editable)
  normalFireSpend: number;
  fatFireSpend: number;

  // Coast FI inputs (editable)
  coastCurrentSpend: number;
  coastMonthlySavings: number;

  // Partner inputs (manual)
  partnerSavings: number;
  myPension: number;
  jointSavings: number;
}

export interface MathsPlanningScenarioResult {
  targetAmount: number;
  remaining: number;
  investmentIncome: number;
  compoundingPeriod: number;
  monthsToSave: number;
  yearsToSave: number;
  targetAge: number;
  targetDate: Date;
  postTaxEarningsRequired: number;
}

export interface MathsPlanningCoastResult {
  retireAge: number;
  currentSpend: number;
  savingPerMonth: number;
  postTaxEarningsRequired: number;
  portfolioAtCoastAge: number;
  swr: number;
  fireSpendAtCoastAge: number;
}

export interface MathsPlanningResults {
  percentOfTarget: number;
  amountNeeded: number;
  targetRetireDate: Date;
  normal: MathsPlanningScenarioResult;
  fat: MathsPlanningScenarioResult;
  coastNow: MathsPlanningCoastResult;
  coastAfterMinFire: MathsPlanningCoastResult;
  totalHouseholdSavings: number;
}

// =============================================================================
// Historical Simulation Types
// =============================================================================

/**
 * Withdrawal strategies for historical simulation
 * - constant_dollar: Fixed initial amount (classic 4% rule), same real value each year
 * - percent_of_portfolio: Fixed percentage of current portfolio value each year
 */
export type WithdrawalStrategy = 'constant_dollar' | 'percent_of_portfolio';

/**
 * Extra income source during retirement (e.g., state pension, part-time work)
 */
export interface ExtraIncomeSource {
  name: string;
  annualAmount: number;       // Amount per year (in today's money)
  startAge: number;           // Age when income starts
  endAge?: number;            // Age when income ends (undefined = lifetime)
  adjustForInflation: boolean; // Whether to adjust for historical inflation
}

/**
 * Configuration for a historical simulation run
 */
export interface SimulationConfig {
  // Duration
  retirementDuration: number;     // Years to simulate (e.g., 30, 40, 50)

  // Portfolio Allocation (must sum to 100)
  stockAllocation: number;        // 0-100%
  bondAllocation: number;         // 0-100%

  // Withdrawal Strategy
  withdrawalStrategy: WithdrawalStrategy;
  initialWithdrawalRate: number;  // e.g., 4.0 for 4%
  initialWithdrawalAmount?: number; // Alternative: fixed amount instead of rate

  // Starting Portfolio
  initialPortfolio: number;

  // Extra Income Sources
  extraIncome: ExtraIncomeSource[];

  // Current age (for extra income calculations)
  currentAge: number;
}

/**
 * Data for a single year within a simulation
 */
export interface YearlySimulationData {
  year: number;                   // Calendar year
  yearIndex: number;              // 0-based year of retirement
  age: number;                    // Age during this year
  portfolioStart: number;         // Portfolio value at start of year
  withdrawal: number;             // Amount withdrawn this year
  extraIncome: number;            // Extra income received (e.g., pension)
  netWithdrawal: number;          // withdrawal - extraIncome (actual portfolio draw)
  stockReturn: number;            // Stock return for this year
  bondReturn: number;             // Bond return for this year
  portfolioReturn: number;        // Weighted portfolio return
  portfolioEnd: number;           // Portfolio value at end of year
  cumulativeInflation: number;    // Cumulative inflation since start
}

/**
 * Result of a single historical simulation (one starting year)
 */
export interface SimulationResult {
  startYear: number;              // Year retirement started
  endYear: number;                // Year retirement ended (or would end)
  success: boolean;               // Portfolio survived the full duration
  failureYear?: number;           // Year portfolio was depleted (if failed)
  yearsLasted: number;            // How many years the portfolio lasted
  finalPortfolioValue: number;    // Portfolio value at end (0 if failed)
  finalPortfolioReal: number;     // Final value in start-year dollars
  minimumPortfolioValue: number;  // Lowest portfolio value during simulation
  minimumPortfolioYear: number;   // Year of lowest value
  totalWithdrawals: number;       // Sum of all withdrawals
  averageAnnualWithdrawal: number; // Average withdrawal per year
  yearlyData: YearlySimulationData[];
}

/**
 * Percentile values for a distribution
 */
export interface PercentileValues {
  p10: number;
  p25: number;
  p50: number;  // Median
  p75: number;
  p90: number;
}

/**
 * Data point for percentile chart (fan chart)
 */
export interface PercentileChartPoint {
  yearIndex: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

/**
 * Complete results of a historical simulation across all starting years
 */
export interface HistoricalSimulationResults {
  // Configuration used
  config: SimulationConfig;

  // Individual simulation results
  simulations: SimulationResult[];

  // Aggregate statistics
  totalSimulations: number;
  successfulSimulations: number;
  failedSimulations: number;
  successRate: number;            // Percentage (0-100)

  // Final portfolio statistics (successful simulations only)
  medianFinalPortfolio: number;
  meanFinalPortfolio: number;
  finalPortfolioPercentiles: PercentileValues;

  // Withdrawal statistics
  medianAnnualWithdrawal: number;
  withdrawalPercentiles: PercentileValues;

  // Failure analysis
  failures: {
    startYear: number;
    failureYear: number;
    yearsLasted: number;
  }[];

  // Worst-case scenario
  worstCase: {
    startYear: number;
    yearsLasted: number;
    finalValue: number;
  };

  // Best-case scenario
  bestCase: {
    startYear: number;
    finalValue: number;
  };

  // Smallest final portfolio (worst successful simulation)
  smallestFinalPortfolio: {
    startYear: number;
    finalValue: number;
  };

  // Data for charts
  percentilesByYear: PercentileChartPoint[];
}

// =============================================================================
// Historical Simulation Zod Schemas
// =============================================================================

export const extraIncomeSourceSchema = z.object({
  name: z.string().min(1),
  annualAmount: z.number().min(0),
  startAge: z.number().int().min(0).max(120),
  endAge: z.number().int().min(0).max(120).optional(),
  adjustForInflation: z.boolean().default(true),
});

export const simulationConfigSchema = z.object({
  retirementDuration: z.number().int().min(1).max(60).default(30),
  stockAllocation: z.number().min(0).max(100).default(75),
  bondAllocation: z.number().min(0).max(100).default(25),
  withdrawalStrategy: z.enum(['constant_dollar', 'percent_of_portfolio']).default('constant_dollar'),
  initialWithdrawalRate: z.number().min(0.5).max(15).default(4),
  initialWithdrawalAmount: z.number().min(0).optional(),
  initialPortfolio: z.number().min(0),
  extraIncome: z.array(extraIncomeSourceSchema).default([]),
  currentAge: z.number().int().min(18).max(100),
}).refine(
  (data) => data.stockAllocation + data.bondAllocation === 100,
  { message: 'Stock and bond allocations must sum to 100%' }
);

export const simulateRequestSchema = z.object({
  config: simulationConfigSchema,
});
