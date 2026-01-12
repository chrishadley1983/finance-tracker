/**
 * Account Types
 *
 * Type definitions for account management.
 */

export type AccountType =
  | 'current'
  | 'savings'
  | 'credit'
  | 'investment'
  | 'pension'
  | 'isa'
  | 'property'
  | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  provider: string; // Maps to institution
  hsbc_account_id: string | null;
  investment_provider: string | null;
  investment_type: string | null;
  notes: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  is_archived: boolean | null;
  include_in_net_worth: boolean | null;
  exclude_from_snapshots: boolean | null;
  last_import_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BalanceSource = 'transactions' | 'snapshot' | 'valuation' | 'none';

export interface AccountWithStats extends Account {
  transactionCount: number;
  earliestTransaction: string | null;
  latestTransaction: string | null;
  currentBalance: number;
  // Balance source tracking
  balanceSource: BalanceSource;
  snapshotDate: string | null; // Date of the snapshot if balanceSource is 'snapshot'
  // For investment accounts
  valuationCount?: number;
  latestValuation?: string | null;
  latestValuationAmount?: number | null;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  provider?: string;
  notes?: string;
  include_in_net_worth?: boolean;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  provider?: string;
  notes?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
  is_archived?: boolean;
  include_in_net_worth?: boolean;
  exclude_from_snapshots?: boolean;
}

// Account type display configuration
export const accountTypeConfig: Record<AccountType, {
  icon: string;
  label: string;
  defaultColor: string;
}> = {
  current: { icon: '🏦', label: 'Current Account', defaultColor: '#3B82F6' },
  savings: { icon: '🏦', label: 'Savings Account', defaultColor: '#10B981' },
  credit: { icon: '💳', label: 'Credit Card', defaultColor: '#EF4444' },
  investment: { icon: '📈', label: 'Investment', defaultColor: '#8B5CF6' },
  pension: { icon: '🏛️', label: 'Pension', defaultColor: '#F59E0B' },
  isa: { icon: '🛡️', label: 'ISA', defaultColor: '#06B6D4' },
  property: { icon: '🏠', label: 'Property', defaultColor: '#6366F1' },
  other: { icon: '💰', label: 'Other', defaultColor: '#6B7280' },
};

// Helper function to get icon for account type
export function getAccountIcon(type: AccountType, customIcon?: string | null): string {
  if (customIcon) return customIcon;
  return accountTypeConfig[type]?.icon || '💰';
}

// Helper function to get label for account type
export function getAccountTypeLabel(type: AccountType): string {
  return accountTypeConfig[type]?.label || 'Other';
}
