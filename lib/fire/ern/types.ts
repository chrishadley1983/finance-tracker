import { z } from 'zod';

// =============================================================================
// Raw Data Types
// =============================================================================

/** A single month's data: [realStockReturn, realBondReturn, cape10x] (all basis points / 10x) */
export type MonthlyReturn = [number, number, number];

// =============================================================================
// ERN Simulation Config
// =============================================================================

/** Wrapper balances for UK tax-optimised drawdown */
export interface WrapperBalances {
  isa: number;
  sipp: number;
  gia: number;
  cash: number;
}

export interface ErnSimConfig {
  equityAllocation: number;       // 0-1 (e.g. 0.80 for 80%)
  horizonYears: number;           // e.g. 48
  preserveFraction: number;       // 0, 0.25, or 0.50
  glidepathEnabled: boolean;      // ramp to 100% equity over 15yr
  annualSpend: number;            // today's money
  portfolio: number;              // ex-property
  statePensionAnnual: number;     // at age 67
  statePensionStartAge: number;   // typically 67
  currentAge: number;             // e.g. 42

  // Pre-retirement / accumulation (all optional, backward-compatible)
  retirementAge?: number;         // when full drawdown begins (default: currentAge = immediate)
  annualSavings?: number;         // contributions during accumulation (default: 0)
  partialEarningsAnnual?: number; // post-retirement income e.g. consulting (default: 0)
  partialEarningsYears?: number;  // duration of partial earnings (default: 0)

  // UK tax wrapper mix (optional, backward-compatible — defaults to all-ISA)
  wrapperBalances?: WrapperBalances;

  // Monte Carlo options
  gogoEnabled: boolean;           // go-go/slow-go/no-go spending
  guardrailEnabled: boolean;      // cut 15% if portfolio < 80% peak
  mcPaths: number;                // default 500
}

// =============================================================================
// ERN Cohort / Historical Simulation Results
// =============================================================================

export interface CohortResult {
  startIndex: number;
  cape: number;
  swr: number;                    // annualised fail-safe SWR %
}

export interface CapeBucket {
  label: string;                  // e.g. '<15', '15-20', '20-25', '25-30', '30+'
  count: number;
  failSafe: number;               // minimum SWR in bucket
  median: number;                  // median SWR in bucket
}

export interface ErnHistoricalResults {
  cohorts: CohortResult[];
  capeBuckets: CapeBucket[];
  failSafeSwr: number;            // overall minimum
  medianSwr: number;              // overall median
  highCapeCohorts: CohortResult[]; // CAPE >= 30
  highCapeFailSafe: number;
  highCapeMedian: number;
  totalCohorts: number;
}

// =============================================================================
// Monte Carlo Results
// =============================================================================

export interface McConfig {
  portfolio: number;
  annualSpend: number;
  equityAllocation: number;
  horizonMonths: number;
  glidepathEnabled: boolean;
  statePensionMonthly: number;
  pensionStartMonth: number;      // month offset from retirement
  gogoEnabled: boolean;
  guardrailEnabled: boolean;
  paths: number;
  seed: number;
  currentAge: number;

  // Accumulation phase (optional, backward-compatible)
  retirementMonth?: number;           // month offset when drawdown begins (0 = immediate)
  monthlySavings?: number;            // monthly contributions during accumulation
  partialEarningsMonthly?: number;    // monthly post-retirement income
  partialEarningsEndMonth?: number;   // month offset when partial earnings stop

  // UK tax wrapper balances (optional — enables tax-aware drawdown)
  wrapperBalances?: WrapperBalances;
  statePensionAnnual?: number;        // needed for tax calc (annual, not monthly)
  statePensionStartAge?: number;      // needed to determine pre/post pension strategy
}

export interface McResults {
  paths: number[][];              // each path = portfolio value at each year
  survivalRate: number;           // 0-100
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  worstPathIndex: number;
  worstPath: number[];
}

// =============================================================================
// CAPE Dynamic Withdrawal
// =============================================================================

export interface CapeWithdrawalPoint {
  cape: number;
  withdrawalRate: number;         // %
}

// =============================================================================
// Combined ERN Dashboard Results
// =============================================================================

export interface ErnDashboardResults {
  historical: ErnHistoricalResults;
  monteCarlo: McResults;
  capeWithdrawal: CapeWithdrawalPoint[];
  ernDynamicWr: number;           // WR at current CAPE
  personalWr: number;             // spend / portfolio * 100
  config: ErnSimConfig;
}

// =============================================================================
// AI Takeaway Types
// =============================================================================

export type FireTakeawayTag = 'strong' | 'watch' | 'idea';

export interface FireTakeaway {
  tag: FireTakeawayTag;
  title: string;
  body: string;
}

// =============================================================================
// Zod Schemas
// =============================================================================

export const ernSimConfigSchema = z.object({
  equityAllocation: z.number().min(0.4).max(1).default(0.8),
  horizonYears: z.number().int().min(20).max(60).default(48),
  preserveFraction: z.number().min(0).max(1).default(0.5),
  glidepathEnabled: z.boolean().default(false),
  annualSpend: z.number().positive().default(50000),
  portfolio: z.number().positive().default(1538050),
  statePensionAnnual: z.number().min(0).default(23000),
  statePensionStartAge: z.number().int().min(60).max(75).default(67),
  currentAge: z.number().int().min(18).max(100).default(42),
  retirementAge: z.number().int().min(18).max(100).optional(),
  annualSavings: z.number().min(0).optional(),
  partialEarningsAnnual: z.number().min(0).optional(),
  partialEarningsYears: z.number().int().min(0).max(30).optional(),
  wrapperBalances: z.object({
    isa: z.number().min(0),
    sipp: z.number().min(0),
    gia: z.number().min(0),
    cash: z.number().min(0),
  }).optional(),
  gogoEnabled: z.boolean().default(true),
  guardrailEnabled: z.boolean().default(false),
  mcPaths: z.number().int().min(100).max(2000).default(500),
});

export const fireTakeawaySchema = z.object({
  tag: z.enum(['strong', 'watch', 'idea']),
  title: z.string(),
  body: z.string(),
});

export const ernSimulateRequestSchema = z.object({
  config: ernSimConfigSchema,
});
