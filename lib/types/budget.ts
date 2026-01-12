// Budget comparison types for the budgets page

export interface BudgetComparison {
  categoryId: string;
  categoryName: string;
  groupName: string;
  isIncome: boolean;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
}

export interface BudgetGroupComparison {
  groupName: string;
  isIncome: boolean;
  categories: BudgetComparison[];
  totals: {
    budget: number;
    actual: number;
    variance: number;
  };
}

export interface SavingsRate {
  totalIncomeBudget: number;
  totalIncomeActual: number;
  totalExpenseBudget: number;
  totalExpenseActual: number;
  savingsBudget: number;
  savingsActual: number;
  savingsRateBudget: number;
  savingsRateActual: number;
}

export interface BudgetSummary {
  year: number;
  month: number | null; // null for full year
  groups: BudgetGroupComparison[];
  savingsRate: SavingsRate;
}

// For bulk budget operations
export interface BulkBudgetEntry {
  categoryId: string;
  year: number;
  month: number;
  amount: number;
}

export interface BulkBudgetRequest {
  entries: BulkBudgetEntry[];
}

// View mode for the budgets page
export type BudgetViewMode = 'month' | 'year';

// Month names for display
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

// Helper to get month name
export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || '';
}

// Helper to format currency
export function formatBudgetCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absAmount);

  return amount < 0 ? `-${formatted}` : formatted;
}

// Helper to determine variance color class
export function getVarianceColorClass(variance: number, isIncome: boolean): string {
  if (variance === 0) return 'text-slate-500';

  if (isIncome) {
    // For income: positive variance (actual > budget) is good
    return variance > 0 ? 'text-emerald-600' : 'text-red-600';
  } else {
    // For expenses: positive variance (under budget) is good
    return variance > 0 ? 'text-emerald-600' : 'text-red-600';
  }
}
