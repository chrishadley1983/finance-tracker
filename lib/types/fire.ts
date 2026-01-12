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
