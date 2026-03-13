/**
 * Monthly report data aggregation.
 *
 * Fetches all required data from Supabase and assembles
 * the MonthlyReportData structure for rendering.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  MonthlyReportData,
  WealthBreakdownItem,
  BudgetComparisonItem,
  MonthlyTrendItem,
  FireScenarioProgress,
  PriorMonthData,
} from './types';
import { generateTakeaways } from './takeaways';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TYPE_LABELS: Record<string, string> = {
  current: 'Current Accounts',
  savings: 'Savings',
  isa: 'ISAs',
  pension: 'Pensions',
  investment: 'Investments',
  property: 'Property',
  credit: 'Credit',
  other: 'Other',
};

/**
 * Aggregate all data for a monthly report.
 */
export async function aggregateMonthlyReport(
  year: number,
  month: number,
): Promise<MonthlyReportData> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Run all queries in parallel
  const [
    budgetResult,
    savingsResult,
    netWorthResult,
    netWorthHistoryResult,
    trendResult,
    fireInputsResult,
    fireScenariosResult,
    priorReportResult,
  ] = await Promise.all([
    // Budget vs actual
    supabaseAdmin.rpc('get_budget_vs_actual', { p_year: year, p_month: month }),

    // Savings rate
    supabaseAdmin.rpc('get_savings_rate', { p_year: year, p_month: month }),

    // Net worth snapshot (latest date for the month)
    fetchNetWorthForMonth(year, month),

    // Net worth history (all time)
    fetchNetWorthHistory(),

    // Monthly income/expense trend (14 months)
    fetchMonthlyTrend(year, month, 14),

    // FIRE inputs
    supabaseAdmin.from('fire_inputs').select('*').limit(1).single(),

    // FIRE scenarios
    supabaseAdmin.from('fire_scenarios').select('*').order('sort_order'),

    // Prior month report
    fetchPriorReport(year, month),
  ]);

  // Process budget comparisons
  const budgetComparisons: BudgetComparisonItem[] = (budgetResult.data || [])
    .filter((r: { is_income: boolean }) => !r.is_income)
    .map((r: {
      category_name: string;
      group_name: string;
      budget_amount: number;
      actual_amount: number;
      variance: number;
    }) => ({
      categoryName: r.category_name,
      groupName: r.group_name,
      budget: Number(r.budget_amount),
      actual: Number(r.actual_amount),
      variance: Number(r.variance),
      variancePct: Number(r.budget_amount) > 0
        ? ((Number(r.actual_amount) - Number(r.budget_amount)) / Number(r.budget_amount)) * 100
        : 0,
    }));

  // Process savings rate
  const savings = savingsResult.data?.[0];
  const income = Number(savings?.total_income_actual) || 0;
  const expenses = Number(savings?.total_expense_actual) || 0;
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  // Net worth
  const { netWorth, wealthBreakdown } = netWorthResult;
  const priorNetWorth = priorReportResult?.netWorth ?? (netWorthHistoryResult.length >= 2
    ? netWorthHistoryResult[netWorthHistoryResult.length - 2]?.total ?? netWorth
    : netWorth);
  const netWorthChange = netWorth - priorNetWorth;
  const netWorthChangePct = priorNetWorth > 0 ? (netWorthChange / priorNetWorth) * 100 : 0;

  // FIRE portfolio (ex property)
  const firePortfolio = wealthBreakdown
    .filter((w) => w.type !== 'property')
    .reduce((sum, w) => sum + w.total, 0);

  // FIRE scenarios progress
  const fireInputs = fireInputsResult.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fireScenarios: FireScenarioProgress[] = (fireScenariosResult.data || []).map((s: any) => {
      const annualSpend = Number(s.annual_spend) || 0;
      const wr = Number(s.withdrawal_rate) || 4;
      const targetAmount = annualSpend / (wr / 100);
      return {
        name: s.name,
        targetAmount,
        currentAmount: firePortfolio,
        progressPct: targetAmount > 0 ? (firePortfolio / targetAmount) * 100 : 0,
      };
    },
  );

  // Build report data (without takeaways first)
  const reportData: MonthlyReportData = {
    year,
    month,
    monthName: MONTH_NAMES[month],
    generatedAt: new Date().toISOString(),
    netWorth,
    netWorthChange,
    netWorthChangePct,
    income,
    expenses,
    savingsRate,
    wealthBreakdown,
    netWorthHistory: netWorthHistoryResult,
    budgetComparisons,
    monthlyTrend: trendResult,
    firePortfolio,
    fireScenarios,
    priorMonth: priorReportResult,
    takeaways: [],
    ideas: [],
  };

  // Generate takeaways
  const { takeaways, ideas } = generateTakeaways(reportData);
  reportData.takeaways = takeaways;
  reportData.ideas = ideas;

  return reportData;
}

// =============================================================================
// Helper queries
// =============================================================================

async function fetchNetWorthForMonth(
  year: number,
  month: number,
): Promise<{ netWorth: number; wealthBreakdown: WealthBreakdownItem[] }> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Get latest snapshot date in the month
  const { data } = await supabaseAdmin
    .from('wealth_snapshots')
    .select('date')
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: false })
    .limit(1);

  const snapshotDate = data?.[0]?.date ?? startDate;

  // Get balances by type for that date
  const { data: snapshots } = await supabaseAdmin
    .from('wealth_snapshots')
    .select('balance, account_id')
    .eq('date', snapshotDate);

  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, type, include_in_net_worth')
    .eq('include_in_net_worth', true);

  const accountMap = new Map(
    (accounts || []).map((a: { id: string; type: string }) => [a.id, a.type]),
  );

  const typeMap = new Map<string, number>();
  let netWorth = 0;

  for (const s of snapshots || []) {
    const type = accountMap.get(s.account_id);
    if (!type) continue;
    const balance = Number(s.balance);
    netWorth += balance;
    typeMap.set(type, (typeMap.get(type) || 0) + balance);
  }

  const wealthBreakdown: WealthBreakdownItem[] = Array.from(typeMap.entries()).map(
    ([type, total]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      total,
    }),
  );

  return { netWorth, wealthBreakdown };
}

async function fetchNetWorthHistory(): Promise<{ date: string; total: number }[]> {
  const { data } = await supabaseAdmin
    .from('wealth_snapshots')
    .select('date, balance, account_id');

  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('include_in_net_worth', true);

  const validAccounts = new Set((accounts || []).map((a: { id: string }) => a.id));
  const dateMap = new Map<string, number>();

  for (const s of data || []) {
    if (!validAccounts.has(s.account_id)) continue;
    dateMap.set(s.date, (dateMap.get(s.date) || 0) + Number(s.balance));
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

async function fetchMonthlyTrend(
  year: number,
  month: number,
  months: number,
): Promise<MonthlyTrendItem[]> {
  // Calculate start date (go back 'months' months)
  let startYear = year;
  let startMonth = month - months + 1;
  while (startMonth <= 0) {
    startMonth += 12;
    startYear--;
  }

  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Fetch transactions with categories
  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select('date, amount, category_id')
    .gte('date', startDate)
    .lt('date', endDate);

  const { data: categories } = await supabaseAdmin
    .from('categories')
    .select('id, is_income, exclude_from_totals');

  const catMap = new Map(
    (categories || []).map((c: { id: string; is_income: boolean; exclude_from_totals: boolean }) => [
      c.id,
      { isIncome: c.is_income, excluded: c.exclude_from_totals },
    ]),
  );

  const monthMap = new Map<string, { income: number; expenses: number }>();

  for (const t of transactions || []) {
    if (!t.category_id) continue;
    const cat = catMap.get(t.category_id);
    if (!cat || cat.excluded) continue;

    const monthKey = t.date.slice(0, 7);
    const entry = monthMap.get(monthKey) || { income: 0, expenses: 0 };

    if (cat.isIncome) {
      entry.income += Number(t.amount);
    } else {
      entry.expenses += Math.abs(Number(t.amount));
    }

    monthMap.set(monthKey, entry);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => ({
      month: monthKey,
      monthLabel: monthNames[parseInt(monthKey.split('-')[1], 10) - 1],
      income: data.income,
      expenses: data.expenses,
    }));
}

async function fetchPriorReport(
  year: number,
  month: number,
): Promise<PriorMonthData | null> {
  const priorMonth = month === 1 ? 12 : month - 1;
  const priorYear = month === 1 ? year - 1 : year;

  try {
    // monthly_reports table may not be in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any)
      .from('monthly_reports')
      .select('report_data')
      .eq('year', priorYear)
      .eq('month', priorMonth)
      .single();

    if (!data?.report_data) return null;

    const rd = data.report_data as Record<string, unknown>;
    return {
      netWorth: Number(rd.net_worth) || 0,
      income: Number(rd.income) || 0,
      expenses: Number(rd.expenses) || 0,
      savingsRate: Number(rd.savings_rate) || 0,
      overBudgetCount: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Save report data to the monthly_reports table.
 */
export async function saveMonthlyReport(data: MonthlyReportData): Promise<void> {
  const reportSnapshot = {
    net_worth: data.netWorth,
    net_worth_change: data.netWorthChange,
    income: data.income,
    expenses: data.expenses,
    savings_rate: data.savingsRate,
    fire_portfolio: data.firePortfolio,
    wealth_breakdown: Object.fromEntries(data.wealthBreakdown.map((w) => [w.type, w.total])),
    budget_total: data.budgetComparisons.reduce((sum, c) => sum + c.budget, 0),
    top_categories: data.budgetComparisons
      .filter((c) => c.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 10)
      .map((c) => ({ name: c.categoryName, actual: c.actual, budget: c.budget })),
  };

  // Upsert — ON CONFLICT(year, month) DO UPDATE
  // monthly_reports table may not be in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('monthly_reports')
    .upsert(
      {
        year: data.year,
        month: data.month,
        report_data: reportSnapshot,
      },
      { onConflict: 'year,month' },
    );

  if (error) {
    console.error('Error saving monthly report:', error);
  }
}
