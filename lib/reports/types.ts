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

  /** Holiday (non-essential) spend split + FIRE impact. Optional so report
   *  data generated before this section existed still renders. */
  holidayFire?: HolidayFireData | null;

  /** AI-generated takeaways */
  takeaways: Takeaway[];

  /** AI-generated ideas */
  ideas: Takeaway[];
}

export interface HolidayCategorySpend {
  name: string;
  /** Net spend for the month (refunds/contributions net off). */
  net: number;
}

export interface FireScenarioImpact {
  name: string;
  progressPct: number;
  /** Progress added by this month's portfolio change, in percentage points (null without prior data). */
  progressDeltaPp: number | null;
  /** This month's net savings expressed as percentage points of the scenario target. */
  monthSavingsPp: number;
}

export interface HolidayFireData {
  holidayCategories: HolidayCategorySpend[];
  /** Net Holidays-group spend for the month. */
  holidaySpend: number;
  holidayPctOfExpenses: number;
  expensesExHoliday: number;
  /** Savings rate if holiday spend were excluded — the "underlying" rate. */
  savingsRateExHoliday: number;
  /** Net savings this month (income - expenses). */
  monthSavings: number;
  /** FIRE portfolio change vs the prior month's report (null if unavailable). */
  firePortfolioChange: number | null;
  scenarioImpacts: FireScenarioImpact[];
  /** Illustrative: holidaySpend × 4% SWR = perpetual annual retirement income forgone. */
  holidayForgoneAnnualIncome: number;
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
  annualSpend: number;
  withdrawalRate: number;
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
  /** FIRE portfolio (ex-property) from the prior saved report, if recorded. */
  firePortfolio?: number | null;
}

export type TakeawayTag = 'over budget' | 'watch' | 'strong' | 'idea' | 'blue sky' | 'budget' | 'investment';

export interface Takeaway {
  tag: TakeawayTag;
  title: string;
  body: string;
}
