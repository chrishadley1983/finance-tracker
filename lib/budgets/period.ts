/**
 * Budgets page: the period shown (a month or a whole year) <-> URL search
 * params, plus the pure figures behind the page's opening sentence.
 * Client-safe; no React.
 *
 *   /budgets?month=2026-10           October 2026
 *   /budgets?year=2026&view=year     the whole of 2026
 *   /budgets                         the current month
 */
import { MONTH_NAMES } from '@/lib/format';
import type { BudgetComparison, BudgetGroupComparison } from '@/lib/types/budget';

export type MonthPeriod = { view: 'month'; year: number; month: number };
export type YearPeriod = { view: 'year'; year: number };
export type BudgetPeriod = MonthPeriod | YearPeriod;

interface ReadableParams {
  get(name: string): string | null;
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YEAR_PARAM = /^\d{4}$/;
const validYear = (y: number) => y >= 2000 && y <= 2100;

export function currentMonthPeriod(now: Date = new Date()): MonthPeriod {
  return { view: 'month', year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Read the period from the URL. Anything missing or malformed falls back to the current month. */
export function periodFromSearchParams(params: ReadableParams | null | undefined, now: Date = new Date()): BudgetPeriod {
  const fallback = currentMonthPeriod(now);
  if (!params) return fallback;
  const view = params.get('view');
  const yearRaw = params.get('year');
  if (view === 'year') {
    const year = yearRaw && YEAR_PARAM.test(yearRaw) ? Number(yearRaw) : fallback.year;
    return { view: 'year', year: validYear(year) ? year : fallback.year };
  }
  const m = MONTH_PARAM.exec(params.get('month') ?? '');
  if (m && validYear(Number(m[1]))) return { view: 'month', year: Number(m[1]), month: Number(m[2]) };
  return fallback;
}

/** Query string (without "?") for a period. */
export function periodToQueryString(p: BudgetPeriod): string {
  return p.view === 'year' ? `year=${p.year}&view=year` : `month=${monthKey(p.year, p.month)}`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** The period before or after this one (a month, or a year in year view). */
export function stepPeriod(p: BudgetPeriod, delta: 1 | -1): BudgetPeriod {
  if (p.view === 'year') return { view: 'year', year: p.year + delta };
  const next = shiftMonth(p.year, p.month, delta);
  return { view: 'month', ...next };
}

/** Switch between month and year view, keeping the year (and the current month where it fits). */
export function switchView(p: BudgetPeriod, view: 'month' | 'year', now: Date = new Date()): BudgetPeriod {
  if (view === p.view) return p;
  if (view === 'year') return { view: 'year', year: p.year };
  const month = p.year === now.getFullYear() ? now.getMonth() + 1 : 1;
  return { view: 'month', year: p.year, month };
}

export function periodLabel(p: BudgetPeriod): string {
  return p.view === 'year' ? String(p.year) : `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

export type Timing = 'past' | 'current' | 'future';

export interface PeriodProgress {
  timing: Timing;
  /** Fraction of the period elapsed (0-1), only for the current period. */
  pace?: number;
  /** Whole days left after today (month view), or whole months after this one (year view). */
  remaining?: number;
}

/** Where today sits in the period: used for the pace tick and "N days to go". */
export function periodProgress(p: BudgetPeriod, now: Date = new Date()): PeriodProgress {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (p.view === 'year') {
    if (p.year < y) return { timing: 'past' };
    if (p.year > y) return { timing: 'future' };
    const start = new Date(y, 0, 1).getTime();
    const end = new Date(y + 1, 0, 1).getTime();
    return { timing: 'current', pace: (now.getTime() - start) / (end - start), remaining: 12 - m };
  }
  const here = y * 12 + m;
  const there = p.year * 12 + p.month;
  if (there < here) return { timing: 'past' };
  if (there > here) return { timing: 'future' };
  const days = new Date(y, m, 0).getDate();
  const d = now.getDate();
  return { timing: 'current', pace: d / days, remaining: days - d };
}

export interface BudgetTotals {
  spent: number;
  planned: number;
  income: number;
  incomePlanned: number;
  /** Spending categories over a non-zero budget, worst overspend first. */
  over: BudgetComparison[];
}

export function budgetTotals(groups: BudgetGroupComparison[]): BudgetTotals {
  const spending = groups.filter((g) => !g.isIncome);
  const income = groups.filter((g) => g.isIncome);
  const sum = (gs: BudgetGroupComparison[], k: 'budget' | 'actual') => gs.reduce((s, g) => s + g.totals[k], 0);
  const over = spending
    .flatMap((g) => g.categories)
    .filter((c) => c.budgetAmount > 0 && c.actualAmount > c.budgetAmount)
    .sort((a, b) => b.actualAmount - b.budgetAmount - (a.actualAmount - a.budgetAmount));
  return {
    spent: sum(spending, 'actual'),
    planned: sum(spending, 'budget'),
    income: sum(income, 'actual'),
    incomePlanned: sum(income, 'budget'),
    over,
  };
}

/** "Eating out", "Eating out and Kids", "Eating out, Kids and Pets", "A, B and 3 more". */
export function listNames(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length > max) return `${names.slice(0, max - 1).join(', ')} and ${names.length - (max - 1)} more`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Words for one row: what is left, or by how much it is over. */
export function remainingWords(c: Pick<BudgetComparison, 'budgetAmount' | 'actualAmount' | 'isIncome'>, fmt: (n: number) => string): { text: string; tone: 'muted' | 'bad' | 'in' } {
  const diff = c.budgetAmount - c.actualAmount;
  if (c.isIncome) {
    if (c.budgetAmount === 0 && c.actualAmount === 0) return { text: 'none planned', tone: 'muted' };
    if (diff > 0) return { text: `${fmt(diff)} to come`, tone: 'muted' };
    if (diff < 0) return { text: `${fmt(-diff)} more than planned`, tone: 'in' };
    return { text: 'as planned', tone: 'muted' };
  }
  if (c.budgetAmount === 0) return c.actualAmount > 0 ? { text: 'no budget set', tone: 'bad' } : { text: 'no budget', tone: 'muted' };
  if (diff > 0) return { text: `${fmt(diff)} left`, tone: 'muted' };
  if (diff < 0) return { text: `${fmt(-diff)} over`, tone: 'bad' };
  return { text: 'on budget', tone: 'muted' };
}
