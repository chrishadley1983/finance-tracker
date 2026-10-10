/**
 * Year view "Budget vs actual": per category, the budget for the months so far
 * (the fair comparison mid-year), the actual, the difference and the full-year
 * budget, grouped, with money in / spending / net totals. Pure; client-safe.
 */
import type { BudgetGroupComparison } from '@/lib/types/budget';

export interface YearLine {
  budgetToDate: number;
  actual: number;
  /** actual - budgetToDate */
  diff: number;
  budgetYear: number;
}

export interface YearRow extends YearLine {
  categoryId: string;
  name: string;
  isIncome: boolean;
}

export interface YearGroup extends YearLine {
  name: string;
  isIncome: boolean;
  rows: YearRow[];
}

export interface YearTable {
  /** Months counted in "to date": 12 for past (and future) years, else this month's number. */
  monthsToDate: number;
  income: YearGroup[];
  spending: YearGroup[];
  totals: { income: YearLine; spending: YearLine; net: YearLine };
}

/** Monthly budgets per category: { [categoryId]: { [month 1-12]: amount } }. */
export type MonthlyBudgets = Record<string, Record<number, number>>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const zero = (): YearLine => ({ budgetToDate: 0, actual: 0, diff: 0, budgetYear: 0 });
function add(into: YearLine, l: YearLine) {
  into.budgetToDate += l.budgetToDate;
  into.actual += l.actual;
  into.diff += l.diff;
  into.budgetYear += l.budgetYear;
}
const tidy = (l: YearLine): YearLine => ({
  budgetToDate: round2(l.budgetToDate),
  actual: round2(l.actual),
  diff: round2(l.diff),
  budgetYear: round2(l.budgetYear),
});

export function monthsToDate(year: number, now: Date): number {
  return year === now.getFullYear() ? now.getMonth() + 1 : 12;
}

export function buildYearTable(groups: BudgetGroupComparison[], monthly: MonthlyBudgets | null, year: number, now: Date): YearTable {
  const upTo = monthsToDate(year, now);
  const toDate = (categoryId: string, budgetYear: number) => {
    const m = monthly?.[categoryId];
    if (!m) return upTo === 12 ? budgetYear : (budgetYear * upTo) / 12;
    let s = 0;
    for (let i = 1; i <= upTo; i++) s += Number(m[i] ?? 0);
    return s;
  };

  const out: YearTable = { monthsToDate: upTo, income: [], spending: [], totals: { income: zero(), spending: zero(), net: zero() } };
  for (const g of groups) {
    const group: YearGroup = { name: g.groupName, isIncome: g.isIncome, rows: [], ...zero() };
    for (const c of g.categories) {
      const budgetToDate = toDate(c.categoryId, c.budgetAmount);
      if (budgetToDate === 0 && c.actualAmount === 0 && c.budgetAmount === 0) continue;
      const row: YearRow = {
        categoryId: c.categoryId,
        name: c.categoryName,
        isIncome: c.isIncome,
        ...tidy({ budgetToDate, actual: c.actualAmount, diff: c.actualAmount - budgetToDate, budgetYear: c.budgetAmount }),
      };
      group.rows.push(row);
      add(group, row);
    }
    if (group.rows.length === 0) continue;
    Object.assign(group, tidy(group));
    (g.isIncome ? out.income : out.spending).push(group);
    add(g.isIncome ? out.totals.income : out.totals.spending, group);
  }
  const { income, spending } = out.totals;
  out.totals.income = tidy(income);
  out.totals.spending = tidy(spending);
  out.totals.net = tidy({
    budgetToDate: income.budgetToDate - spending.budgetToDate,
    actual: income.actual - spending.actual,
    diff: income.actual - spending.actual - (income.budgetToDate - spending.budgetToDate),
    budgetYear: income.budgetYear - spending.budgetYear,
  });
  return out;
}

/**
 * Words and tone for a difference: spending over budget is bad, under is
 * neutral; income short of plan is a warning, above plan is money in.
 * For net (money kept), more is good.
 */
export function diffWords(diff: number, kind: 'spending' | 'income' | 'net', fmt: (n: number) => string): { text: string; tone: 'muted' | 'bad' | 'warn' | 'in' } {
  if (Math.abs(diff) < 0.5) return { text: 'on budget', tone: 'muted' };
  const amount = fmt(Math.abs(diff));
  if (kind === 'spending') return diff > 0 ? { text: `${amount} over`, tone: 'bad' } : { text: `${amount} under`, tone: 'muted' };
  if (kind === 'income') return diff > 0 ? { text: `${amount} above`, tone: 'in' } : { text: `${amount} short`, tone: 'warn' };
  return diff > 0 ? { text: `${amount} better`, tone: 'in' } : { text: `${amount} worse`, tone: 'warn' };
}
