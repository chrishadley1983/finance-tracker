/**
 * Types for the Monthly Finance Report.
 */

export interface MonthlyReportData {
  /** Report period */
  year: number;
  month: number;
  monthName: string;
  generatedAt: string;

  /** Top-level metrics */
  netWorth: number;
  netWorthChange: number;
  netWorthChangePct: number;
  income: number;
  expenses: number;
  savingsRate: number;

  /** Net worth breakdown by account type */
  wealthBreakdown: WealthBreakdownItem[];

  /** Net worth time series (for trend chart) */
  netWorthHistory: { date: string; total: number }[];

  /** Budget vs actual by category */
  budgetComparisons: BudgetComparisonItem[];

  /** Monthly income/expense trend (14 months for context) */
  monthlyTrend: MonthlyTrendItem[];

  /** FIRE progress */
  firePortfolio: number;
  fireScenarios: FireScenarioProgress[];

  /** Prior month data (if available) */
  priorMonth: PriorMonthData | null;

  /** AI-generated takeaways */
  takeaways: Takeaway[];

  /** AI-generated ideas */
  ideas: Takeaway[];
}

export interface WealthBreakdownItem {
  type: string;
  label: string;
  total: number;
}

export interface BudgetComparisonItem {
  categoryName: string;
  groupName: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
}

export interface MonthlyTrendItem {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
}

export interface FireScenarioProgress {
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPct: number;
}

export interface PriorMonthData {
  netWorth: number;
  income: number;
  expenses: number;
  savingsRate: number;
  overBudgetCount: number;
}

export type TakeawayTag = 'over budget' | 'watch' | 'strong' | 'idea' | 'blue sky' | 'budget' | 'investment';

export interface Takeaway {
  tag: TakeawayTag;
  title: string;
  body: string;
}
