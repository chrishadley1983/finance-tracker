/**
 * One budget line in detail (the panel that opens from any budget row):
 * month-by-month actual vs budget, the trend, and the period totals.
 * Pure and client-safe; GET /api/budgets/category/[id] feeds it raw rows.
 *
 * "Actual" follows get_budget_vs_actual: income categories count money in
 * (amount > 0), spending categories count -amount, so refunds net off.
 */
import { MONTH_SHORT, MONTH_NAMES } from '@/lib/format';
import { monthKey, shiftMonth } from './period';

export interface DetailMonth {
  /** YYYY-MM */
  key: string;
  year: number;
  month: number;
  /** "Oct" (or "Oct 25" when the chart spans two years). */
  label: string;
  actual: number;
  budget: number;
  /** The month is still running (its actual is incomplete). */
  partial: boolean;
  /** The month has not started yet (only budget is meaningful). */
  future: boolean;
}

export interface DetailTrend {
  /** Average of the last up-to-6 complete months. */
  recentAvg: number | null;
  /** Average of the 6 complete months before those. */
  priorAvg: number | null;
  /** recentAvg vs priorAvg, as a fraction (0.12 = up 12%). */
  change: number | null;
  /** Same month a year earlier (month view only). */
  sameMonthLastYear: number | null;
  /** Number of complete months behind recentAvg. */
  recentMonths: number;
}

export interface CategoryDetail {
  category: { id: string; name: string; groupName: string; isIncome: boolean };
  period: { view: 'month' | 'year'; year: number; month: number | null; label: string; from: string; to: string };
  /** Period totals. */
  budget: number;
  actual: number;
  /** Year view of the current year: budget for the months so far (incl. this one). */
  budgetToDate: number | null;
  /** 12 points for the chart, oldest first. */
  months: DetailMonth[];
  trend: DetailTrend;
  recent: { id: string; date: string; description: string; amount: number; account: string | null }[];
  /** Transactions in the period. */
  count: number;
}

export interface DetailInput {
  category: CategoryDetail['category'];
  view: 'month' | 'year';
  year: number;
  month: number | null;
  now: Date;
  /** Budget rows in the window. */
  budgets: { year: number; month: number; amount: number }[];
  /** Transactions of this category in the window (date YYYY-MM-DD, signed amount). */
  transactions: { date: string; amount: number }[];
  recent: CategoryDetail['recent'];
  count: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The months the endpoint needs: 24 ending at the anchor (chart + trend). */
export function detailWindow(view: 'month' | 'year', year: number, month: number | null) {
  const anchor = view === 'month' && month ? { year, month } : { year, month: 12 };
  const start = shiftMonth(anchor.year, anchor.month, -23);
  const last = new Date(Date.UTC(anchor.year, anchor.month, 0)).getUTCDate();
  return {
    anchor,
    start,
    from: `${start.year}-${pad(start.month)}-01`,
    to: `${anchor.year}-${pad(anchor.month)}-${pad(last)}`,
  };
}

/** First and last day of the selected period. */
export function periodBounds(view: 'month' | 'year', year: number, month: number | null) {
  if (view === 'month' && month) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Sign-aware actual for one transaction (matches get_budget_vs_actual). */
export function actualOf(amount: number, isIncome: boolean): number {
  if (isIncome) return amount > 0 ? amount : 0;
  return -amount;
}

export function buildCategoryDetail(input: DetailInput): CategoryDetail {
  const { category, view, year, month, now } = input;
  const { anchor, start } = detailWindow(view, year, month);
  const nowKey = monthKey(now.getFullYear(), now.getMonth() + 1);

  // Index budgets and actuals by month.
  const budgetBy = new Map<string, number>();
  for (const b of input.budgets) {
    const k = monthKey(b.year, b.month);
    budgetBy.set(k, (budgetBy.get(k) ?? 0) + Number(b.amount));
  }
  const actualBy = new Map<string, number>();
  for (const t of input.transactions) {
    const k = t.date.slice(0, 7);
    actualBy.set(k, (actualBy.get(k) ?? 0) + actualOf(Number(t.amount), category.isIncome));
  }

  const all: DetailMonth[] = [];
  for (let i = 0; i < 24; i++) {
    const m = shiftMonth(start.year, start.month, i);
    const key = monthKey(m.year, m.month);
    all.push({
      key,
      year: m.year,
      month: m.month,
      label: MONTH_SHORT[m.month - 1],
      actual: round2(actualBy.get(key) ?? 0),
      budget: round2(budgetBy.get(key) ?? 0),
      partial: key === nowKey,
      future: key > nowKey,
    });
  }

  const months = all.slice(12);
  // When the 12 months straddle a year end, say which year each January starts.
  if (months[0].year !== months[11].year) {
    for (const p of months) if (p.month === 1) p.label = `Jan ${String(p.year).slice(2)}`;
  }

  // Period totals.
  const inPeriod = view === 'month' ? months.filter((p) => p.key === monthKey(anchor.year, anchor.month)) : months.filter((p) => p.year === year);
  const budget = round2(inPeriod.reduce((s, p) => s + p.budget, 0));
  const actual = round2(inPeriod.reduce((s, p) => s + p.actual, 0));
  const budgetToDate =
    view === 'year' && year === now.getFullYear()
      ? round2(inPeriod.filter((p) => !p.future).reduce((s, p) => s + p.budget, 0))
      : null;

  // Trend over complete months up to the anchor.
  const complete = all.filter((p) => !p.partial && !p.future);
  const recent = complete.slice(-6);
  const prior = complete.slice(-12, -6);
  const avg = (ps: DetailMonth[]) => (ps.length ? round2(ps.reduce((s, p) => s + p.actual, 0) / ps.length) : null);
  const recentAvg = avg(recent);
  const priorAvg = prior.length === 6 ? avg(prior) : null;
  const change = recentAvg !== null && priorAvg !== null && priorAvg > 0 ? (recentAvg - priorAvg) / priorAvg : null;
  const lastYear = view === 'month' && month ? all.find((p) => p.year === year - 1 && p.month === month) : undefined;

  const { from, to } = periodBounds(view, year, month);
  return {
    category,
    period: {
      view,
      year,
      month: view === 'month' ? month : null,
      label: view === 'month' && month ? `${MONTH_NAMES[month - 1]} ${year}` : String(year),
      from,
      to,
    },
    budget,
    actual,
    budgetToDate,
    months,
    trend: {
      recentAvg,
      priorAvg,
      change,
      sameMonthLastYear: lastYear ? lastYear.actual : null,
      recentMonths: recent.length,
    },
    recent: input.recent,
    count: input.count,
  };
}

/** Link to the Transactions page pre-filtered to this category and period. */
export function detailTransactionsHref(d: Pick<CategoryDetail, 'category' | 'period'>): string {
  const q = new URLSearchParams({ categoryId: d.category.id, dateFrom: d.period.from, dateTo: d.period.to });
  return `/transactions?${q.toString()}`;
}

type Fmt = (n: number) => string;

/**
 * Opening sentence, e.g. "£146 of £350 spent in September 2026, £204 under budget."
 * Spending over budget / income short of plan is flagged; the tone drives colour.
 */
export function detailLede(d: CategoryDetail, fmt: Fmt): { text: string; tone: 'ink' | 'bad' | 'warn' | 'in' } {
  const inc = d.category.isIncome;
  const verb = inc ? 'received' : 'spent';
  const yearSoFar = d.period.view === 'year' && d.budgetToDate !== null;
  const against = yearSoFar ? d.budgetToDate! : d.budget;
  const where = d.period.view === 'year' ? `in ${d.period.label}${yearSoFar ? ' so far' : ''}` : `in ${d.period.label}`;
  if (against === 0 && d.budget === 0) {
    return { text: `${fmt(d.actual)} ${verb} ${where}, with no budget set.`, tone: 'ink' };
  }
  const head = yearSoFar
    ? `${fmt(d.actual)} ${verb} ${where}, against ${fmt(against)} budgeted to date (${fmt(d.budget)} for the year)`
    : `${fmt(d.actual)} of ${fmt(d.budget)} ${verb} ${where}`;
  const diff = d.actual - against;
  if (Math.abs(diff) < 0.5) return { text: `${head}, exactly on budget.`, tone: 'ink' };
  if (inc) {
    return diff > 0
      ? { text: `${head}, ${fmt(diff)} more than planned.`, tone: 'in' }
      : { text: `${head}, ${fmt(-diff)} short of plan.`, tone: 'warn' };
  }
  return diff > 0
    ? { text: `${head}, ${fmt(diff)} over budget.`, tone: 'bad' }
    : { text: `${head}, ${fmt(-diff)} under budget.`, tone: 'ink' };
}

/** Trend in words, e.g. "Averaging £481 a month over the last 6 months, up 47% on the 6 before." */
export function trendSentence(d: CategoryDetail, fmt: Fmt): string | null {
  const t = d.trend;
  if (t.recentAvg === null) return null;
  const months = t.recentMonths === 1 ? 'the last month' : `the last ${t.recentMonths} months`;
  let s = `Averaging ${fmt(t.recentAvg)} a month over ${months}`;
  if (t.change !== null) {
    const pct = Math.round(Math.abs(t.change) * 100);
    s += pct < 5 ? ', about the same as the 6 before' : `, ${t.change > 0 ? 'up' : 'down'} ${pct}% on the 6 before`;
  }
  s += '.';
  if (t.sameMonthLastYear !== null && d.period.month) {
    s += ` ${MONTH_NAMES[d.period.month - 1]} last year: ${fmt(t.sameMonthLastYear)}.`;
  }
  return s;
}
