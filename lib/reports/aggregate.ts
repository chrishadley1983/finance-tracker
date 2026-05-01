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
  // Run all queries in parallel
  const [
    budgetResult,
    netWorthResult,
    netWorthHistoryResult,
    trendResult,
    fireInputsResult,
    fireScenariosResult,
    priorReportResult,
  ] = await Promise.all([
    // Budget vs actual
    supabaseAdmin.rpc('get_budget_vs_actual', { p_year: year, p_month: month }),

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

  // Get excluded category IDs (transfers, credit card payments, etc.)
  const { data: excludedCats } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('exclude_from_totals', true);
  const excludedIds = new Set((excludedCats || []).map((c: { id: string }) => c.id));

  // The get_budget_vs_actual RPC returns SUM(ABS(amount)) per category, so a
  // refund (credit in an expense category) inflates the expense total.
  // Recompute actuals sign-aware from raw transactions, matching the dashboard
  // (`/api/transactions/summary`): expenses = debits in non-income categories,
  // income = credits in income categories.
  const monthTransactions = await fetchTransactionsForMonth(year, month);

  const incomeCategoryIds = new Set(
    (budgetResult.data || [])
      .filter((r: { is_income: boolean; category_id: string }) => r.is_income)
      .map((r: { category_id: string }) => r.category_id),
  );

  const actualByCategory = new Map<string, number>();
  let income = 0;
  let expenses = 0;
  for (const t of monthTransactions) {
    const amt = Number(t.amount);
    if (t.category_id && excludedIds.has(t.category_id)) continue;
    const isIncome = t.category_id ? incomeCategoryIds.has(t.category_id) : false;
    if (isIncome) {
      if (amt > 0) {
        income += amt;
        actualByCategory.set(t.category_id!, (actualByCategory.get(t.category_id!) || 0) + amt);
      }
    } else {
      if (amt < 0) {
        const abs = Math.abs(amt);
        expenses += abs;
        if (t.category_id) {
          actualByCategory.set(t.category_id, (actualByCategory.get(t.category_id) || 0) + abs);
        }
      }
    }
  }
  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  // Process budget comparisons — exclude income categories and excluded categories
  const budgetComparisons: BudgetComparisonItem[] = (budgetResult.data || [])
    .filter((r: { is_income: boolean; category_id: string }) => !r.is_income && !excludedIds.has(r.category_id))
    .map((r: {
      category_id: string;
      category_name: string;
      group_name: string;
      budget_amount: number;
    }) => {
      const budget = Number(r.budget_amount);
      const actual = actualByCategory.get(r.category_id) || 0;
      return {
        categoryName: r.category_name,
        groupName: r.group_name,
        budget,
        actual,
        variance: actual - budget,
        variancePct: budget > 0 ? ((actual - budget) / budget) * 100 : 0,
      };
    });

  // Net worth
  const { netWorth, wealthBreakdown } = netWorthResult;
  const netWorthChange = priorReportResult ? netWorth - priorReportResult.netWorth : 0;
  const netWorthChangePct = priorReportResult && priorReportResult.netWorth > 0
    ? (netWorthChange / priorReportResult.netWorth) * 100
    : 0;

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
        annualSpend,
        withdrawalRate: wr,
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
  // The report represents the user's wealth AT END OF MONTH M. Two conventions
  // matter:
  //   - Monthly snapshots (pension, isa, savings, property, other, investment)
  //     are entered on the 1st of each month and represent the prior
  //     month-end. So "end of April" = the 2026-05-01 snapshot.
  //   - Transactional accounts (current, credit) have a seed snapshot and a
  //     stream of transactions; "end of April" = latest snapshot at-or-before
  //     2026-04-30 + sum(transactions in (snapshot.date, 2026-04-30]).
  // The previous logic queried snapshots WHERE date IN [month-01, next-01),
  // which only caught the start-of-month entries (i.e. PRIOR month-end), and
  // ignored transactional accounts entirely. The result diverged from the
  // dashboard by ~£60–70k.
  const TRANSACTIONAL_TYPES = new Set(['current', 'credit']);

  const monthStr = String(month).padStart(2, '0');
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStartStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const monthEndStr = `${year}-${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, type, include_in_net_worth')
    .eq('include_in_net_worth', true);

  const accountTypeMap = new Map<string, string>(
    (accounts || []).map((a: { id: string; type: string }) => [a.id, a.type]),
  );

  const snapshotAccountIds: string[] = [];
  const transactionalAccountIds: string[] = [];
  for (const a of accounts || []) {
    if (TRANSACTIONAL_TYPES.has(a.type)) transactionalAccountIds.push(a.id);
    else snapshotAccountIds.push(a.id);
  }

  const balanceByAccount = new Map<string, number>();

  // Snapshot accounts: latest snapshot at-or-before next-month-01.
  if (snapshotAccountIds.length > 0) {
    const { data: snaps } = await supabaseAdmin
      .from('wealth_snapshots')
      .select('balance, account_id, date')
      .in('account_id', snapshotAccountIds)
      .lte('date', nextMonthStartStr)
      .order('date', { ascending: false });

    for (const s of snaps || []) {
      if (!balanceByAccount.has(s.account_id)) {
        balanceByAccount.set(s.account_id, Number(s.balance));
      }
    }
  }

  // Transactional accounts: latest snapshot at-or-before month-end + sum of
  // transactions in (snapshot.date, month-end].
  if (transactionalAccountIds.length > 0) {
    const { data: snaps } = await supabaseAdmin
      .from('wealth_snapshots')
      .select('balance, account_id, date')
      .in('account_id', transactionalAccountIds)
      .lte('date', monthEndStr)
      .order('date', { ascending: false });

    const baselineByAccount = new Map<string, { date: string; balance: number }>();
    for (const s of snaps || []) {
      if (!baselineByAccount.has(s.account_id)) {
        baselineByAccount.set(s.account_id, { date: s.date, balance: Number(s.balance) });
      }
    }

    const txByAccount = new Map<string, { date: string; amount: number }[]>();
    let txFrom = 0;
    const txPageSize = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: page } = await supabaseAdmin
        .from('transactions')
        .select('account_id, date, amount')
        .in('account_id', transactionalAccountIds)
        .lte('date', monthEndStr)
        .range(txFrom, txFrom + txPageSize - 1);
      if (!page || page.length === 0) break;
      for (const t of page) {
        const arr = txByAccount.get(t.account_id) || [];
        arr.push({ date: t.date, amount: Number(t.amount) });
        txByAccount.set(t.account_id, arr);
      }
      if (page.length < txPageSize) break;
      txFrom += txPageSize;
    }

    for (const accountId of transactionalAccountIds) {
      const baseline = baselineByAccount.get(accountId);
      if (!baseline) continue;
      let balance = baseline.balance;
      for (const tx of txByAccount.get(accountId) || []) {
        if (tx.date > baseline.date) balance += tx.amount;
      }
      balanceByAccount.set(accountId, balance);
    }
  }

  const typeMap = new Map<string, number>();
  let netWorth = 0;
  for (const [accountId, balance] of Array.from(balanceByAccount.entries())) {
    const type = accountTypeMap.get(accountId);
    if (!type) continue;
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
    .select('date, balance, account_id')
    .order('date', { ascending: true });

  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('include_in_net_worth', true);

  const validAccounts = new Set((accounts || []).map((a: { id: string }) => a.id));

  // Build a running ledger: for each date, carry forward last known balance per account
  // Group snapshots by date first
  const snapshotsByDate = new Map<string, Map<string, number>>();
  for (const s of data || []) {
    if (!validAccounts.has(s.account_id)) continue;
    if (!snapshotsByDate.has(s.date)) snapshotsByDate.set(s.date, new Map());
    snapshotsByDate.get(s.date)!.set(s.account_id, Number(s.balance));
  }

  const dates = Array.from(snapshotsByDate.keys()).sort();
  const currentBalances = new Map<string, number>(); // running balance per account
  const result: { date: string; total: number }[] = [];

  for (const date of dates) {
    const updates = snapshotsByDate.get(date)!;
    // Apply updates for this date
    for (const [accountId, balance] of Array.from(updates.entries())) {
      currentBalances.set(accountId, balance);
    }
    // Sum all known balances
    let total = 0;
    for (const balance of Array.from(currentBalances.values())) {
      total += balance;
    }
    result.push({ date, total });
  }

  return result;
}

async function fetchTransactionsForMonth(
  year: number,
  month: number,
): Promise<{ amount: number; category_id: string | null }[]> {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const all: { amount: number; category_id: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: page } = await supabaseAdmin
      .from('transactions')
      .select('amount, category_id')
      .gte('date', startDate)
      .lt('date', endDate)
      .range(from, from + pageSize - 1);
    if (!page || page.length === 0) break;
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
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

  // Fetch ALL transactions (paginate past Supabase 1000-row default limit)
  const allTransactions: { date: string; amount: number; category_id: string | null }[] = [];
  let from = 0;
  const pageSize = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: page } = await supabaseAdmin
      .from('transactions')
      .select('date, amount, category_id')
      .gte('date', startDate)
      .lt('date', endDate)
      .range(from, from + pageSize - 1);
    if (!page || page.length === 0) break;
    allTransactions.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  const transactions = allTransactions;

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
export async function saveMonthlyReport(data: MonthlyReportData, html?: string): Promise<void> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {
    year: data.year,
    month: data.month,
    report_data: reportSnapshot,
  };
  if (html) {
    row.report_html = html;
  }

  // Upsert — ON CONFLICT(year, month) DO UPDATE
  // monthly_reports table may not be in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('monthly_reports')
    .upsert(row, { onConflict: 'year,month' });

  if (error) {
    console.error('Error saving monthly report:', error);
  }
}

/**
 * List all saved monthly reports (summary data for the index page).
 */
export async function listMonthlyReports(): Promise<{
  year: number;
  month: number;
  report_data: Record<string, unknown>;
  generated_at: string;
}[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('monthly_reports')
    .select('year, month, report_data, generated_at')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) {
    console.error('Error listing monthly reports:', error);
    return [];
  }
  return data || [];
}

/**
 * Get the stored HTML for a specific monthly report.
 * Returns null if no HTML is stored (report predates this feature).
 */
export async function getMonthlyReportHtml(year: number, month: number): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('monthly_reports')
    .select('report_html')
    .eq('year', year)
    .eq('month', month)
    .single();

  if (error || !data?.report_html) {
    return null;
  }
  return data.report_html as string;
}
