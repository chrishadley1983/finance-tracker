import { z } from 'zod';

// =============================================================================
// INVESTMENT PROVIDER & TYPE ENUMS
// =============================================================================

export const INVESTMENT_PROVIDERS = [
  'vanguard',
  'interactive_investor',
  'legal_and_general',
  'hargreaves_lansdown',
  'aj_bell',
  'fidelity',
  'other',
] as const;

export type InvestmentProvider = (typeof INVESTMENT_PROVIDERS)[number];

export const INVESTMENT_PROVIDER_LABELS: Record<InvestmentProvider, string> = {
  vanguard: 'Vanguard',
  interactive_investor: 'Interactive Investor',
  legal_and_general: 'Legal & General',
  hargreaves_lansdown: 'Hargreaves Lansdown',
  aj_bell: 'AJ Bell',
  fidelity: 'Fidelity',
  other: 'Other',
};

export const INVESTMENT_TYPES = [
  'isa',
  'sipp',
  'gia',
  'workplace_pension',
  'other',
] as const;

export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  isa: 'ISA',
  sipp: 'SIPP',
  gia: 'GIA',
  workplace_pension: 'Workplace Pension',
  other: 'Other',
};

// =============================================================================
// INTERFACES
// =============================================================================

export interface InvestmentValuation {
  id: string;
  accountId: string;
  date: string;
  value: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: 'investment';
  provider: string;
  investmentProvider: InvestmentProvider | null;
  investmentType: InvestmentType | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  latestValuation?: InvestmentValuation | null;
}

export interface InvestmentSummary {
  totalValue: number;
  accountCount: number;
  byProvider: { provider: string; label: string; value: number; count: number }[];
  byType: { type: string; label: string; value: number; count: number }[];
  lastUpdated: string | null;
}

export interface ValuationWithChange extends InvestmentValuation {
  change?: number;
  changePercent?: number;
}

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const investmentProviderSchema = z.enum(INVESTMENT_PROVIDERS);
export const investmentTypeSchema = z.enum(INVESTMENT_TYPES);

export const createInvestmentAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  investmentProvider: investmentProviderSchema,
  investmentType: investmentTypeSchema,
  accountReference: z.string().max(100).optional(),
});

export const updateInvestmentAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  investmentProvider: investmentProviderSchema.optional(),
  investmentType: investmentTypeSchema.optional(),
  accountReference: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createValuationSchema = z.object({
  date: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format'),
  value: z.number().positive('Value must be positive'),
  notes: z.string().max(500).optional(),
});

export const updateValuationSchema = z.object({
  date: z.string().refine((val) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format').optional(),
  value: z.number().positive('Value must be positive').optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const bulkValuationsSchema = z.object({
  valuations: z.array(
    z.object({
      date: z.string(),
      value: z.number().positive(),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one valuation is required'),
});

// =============================================================================
// TYPE EXPORTS FOR SCHEMAS
// =============================================================================

export type CreateInvestmentAccountInput = z.infer<typeof createInvestmentAccountSchema>;
export type UpdateInvestmentAccountInput = z.infer<typeof updateInvestmentAccountSchema>;
export type CreateValuationInput = z.infer<typeof createValuationSchema>;
export type UpdateValuationInput = z.infer<typeof updateValuationSchema>;
export type BulkValuationsInput = z.infer<typeof bulkValuationsSchema>;
