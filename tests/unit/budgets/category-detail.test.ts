import { describe, it, expect } from 'vitest';
import {
  actualOf,
  buildCategoryDetail,
  detailLede,
  detailTransactionsHref,
  detailWindow,
  trendSentence,
  type DetailInput,
} from '@/lib/budgets/category-detail';
import { buildYearTable, diffWords, monthsToDate } from '@/lib/budgets/year-table';
import type { BudgetGroupComparison } from '@/lib/types/budget';

const fmt = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const NOW = new Date(2026, 9, 8); // 8 Oct 2026

function input(over: Partial<DetailInput> = {}): DetailInput {
  return {
    category: { id: 'cat', name: 'Eating out', groupName: 'Entertainment', isIncome: false },
    view: 'month',
    year: 2026,
    month: 9,
    now: NOW,
    budgets: [],
    transactions: [],
    recent: [],
    count: 0,
    ...over,
  };
}

describe('category detail', () => {
  it('uses a 24-month window ending at the selected month (or December in year view)', () => {
    expect(detailWindow('month', 2026, 9)).toMatchObject({ from: '2024-10-01', to: '2026-09-30' });
    expect(detailWindow('year', 2026, null)).toMatchObject({ from: '2025-01-01', to: '2026-12-31' });
  });

  it('counts actuals sign-aware, like the budget page', () => {
    expect(actualOf(-40, false)).toBe(40);
    expect(actualOf(10, false)).toBe(-10); // refund nets off
    expect(actualOf(2000, true)).toBe(2000);
    expect(actualOf(-5, true)).toBe(0);
  });

  it('builds 12 chart months, the period totals and flags this month and future months', () => {
    const d = buildCategoryDetail(
      input({
        view: 'year',
        month: null,
        budgets: Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, amount: 350 })),
        transactions: [
          { date: '2026-09-25', amount: -41.33 },
          { date: '2026-09-17', amount: -100 },
          { date: '2026-10-05', amount: -85.14 },
          { date: '2026-08-02', amount: 20 }, // refund
        ],
      })
    );
    expect(d.months.map((m) => m.key)).toEqual(Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`));
    expect(d.months[8]).toMatchObject({ actual: 141.33, budget: 350, partial: false, future: false });
    expect(d.months[9]).toMatchObject({ actual: 85.14, partial: true });
    expect(d.months[10]).toMatchObject({ future: true });
    expect(d.actual).toBe(206.47);
    expect(d.budget).toBe(4200);
    expect(d.budgetToDate).toBe(3500); // Jan–Oct
    expect(d.period).toMatchObject({ label: '2026', from: '2026-01-01', to: '2026-12-31' });
  });

  it('labels January with its year when the 12 months straddle a year end', () => {
    const d = buildCategoryDetail(input({ month: 3 }));
    expect(d.months[0].label).toBe('Apr');
    expect(d.months.find((m) => m.month === 1)?.label).toBe('Jan 26');
  });

  it('works out the trend from complete months and last year’s same month', () => {
    const tx = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(2025, 9 + i, 10); // Oct 2025 .. Sep 2026
      tx.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`, amount: i < 6 ? -100 : -150 });
    }
    tx.push({ date: '2025-09-10', amount: -77 });
    const d = buildCategoryDetail(input({ transactions: tx }));
    expect(d.trend).toMatchObject({ recentAvg: 150, priorAvg: 100, sameMonthLastYear: 77, recentMonths: 6 });
    expect(d.trend.change).toBeCloseTo(0.5);
    expect(trendSentence(d, fmt)).toBe('Averaging £150 a month over the last 6 months, up 50% on the 6 before. September last year: £77.');
  });

  it('describes the period in a sentence with the right tone', () => {
    const base = buildCategoryDetail(input({ budgets: [{ year: 2026, month: 9, amount: 350 }], transactions: [{ date: '2026-09-02', amount: -146 }] }));
    expect(detailLede(base, fmt)).toEqual({ text: '£146 of £350 spent in September 2026, £204 under budget.', tone: 'ink' });
    const over = { ...base, actual: 400 };
    expect(detailLede(over, fmt)).toEqual({ text: '£400 of £350 spent in September 2026, £50 over budget.', tone: 'bad' });
    const inc = { ...base, category: { ...base.category, isIncome: true }, actual: 300 };
    expect(detailLede(inc, fmt).tone).toBe('warn');
    const none = { ...base, budget: 0 };
    expect(detailLede(none, fmt).text).toBe('£146 spent in September 2026, with no budget set.');
  });

  it('links to Transactions filtered to the category and period', () => {
    const d = buildCategoryDetail(input());
    expect(detailTransactionsHref(d)).toBe('/transactions?categoryId=cat&dateFrom=2026-09-01&dateTo=2026-09-30');
  });
});

describe('year table', () => {
  const groups: BudgetGroupComparison[] = [
    {
      groupName: 'Income',
      isIncome: true,
      categories: [{ categoryId: 'inc', categoryName: 'Salary', groupName: 'Income', isIncome: true, budgetAmount: 24000, actualAmount: 19000, variance: 0 }],
      totals: { budget: 24000, actual: 19000, variance: 0 },
    },
    {
      groupName: 'Food',
      isIncome: false,
      categories: [
        { categoryId: 'g', categoryName: 'Groceries', groupName: 'Food', isIncome: false, budgetAmount: 7200, actualAmount: 6400, variance: 0 },
        { categoryId: 'e', categoryName: 'Eating out', groupName: 'Food', isIncome: false, budgetAmount: 4200, actualAmount: 3724.49, variance: 0 },
        { categoryId: 'z', categoryName: 'Unused', groupName: 'Food', isIncome: false, budgetAmount: 0, actualAmount: 0, variance: 0 },
      ],
      totals: { budget: 11400, actual: 10124.49, variance: 0 },
    },
  ];
  const monthly = {
    inc: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 2000])),
    g: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 600])),
    e: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 350])),
  };

  it('compares against the budget for the months so far in the current year', () => {
    expect(monthsToDate(2026, NOW)).toBe(10);
    expect(monthsToDate(2025, NOW)).toBe(12);
    const t = buildYearTable(groups, monthly, 2026, NOW);
    const eat = t.spending[0].rows.find((r) => r.name === 'Eating out')!;
    expect(eat).toMatchObject({ budgetToDate: 3500, actual: 3724.49, diff: 224.49, budgetYear: 4200 });
    expect(t.spending[0].rows.map((r) => r.name)).toEqual(['Groceries', 'Eating out']); // empty line dropped
    expect(t.totals.income).toMatchObject({ budgetToDate: 20000, actual: 19000, diff: -1000 });
    expect(t.totals.spending).toMatchObject({ budgetToDate: 9500, actual: 10124.49 });
    expect(t.totals.net).toMatchObject({ budgetToDate: 10500, actual: 8875.51, diff: -1624.49, budgetYear: 12600 });
  });

  it('uses the full year for past years and a pro-rata guess without monthly budgets', () => {
    expect(buildYearTable(groups, monthly, 2025, NOW).totals.spending.budgetToDate).toBe(11400);
    expect(buildYearTable(groups, null, 2026, NOW).spending[0].rows[0].budgetToDate).toBe(6000);
  });

  it('words differences by kind', () => {
    expect(diffWords(224.49, 'spending', fmt)).toEqual({ text: '£224 over', tone: 'bad' });
    expect(diffWords(-50, 'spending', fmt)).toEqual({ text: '£50 under', tone: 'muted' });
    expect(diffWords(-1000, 'income', fmt)).toEqual({ text: '£1,000 short', tone: 'warn' });
    expect(diffWords(300, 'net', fmt)).toEqual({ text: '£300 better', tone: 'in' });
    expect(diffWords(0.2, 'net', fmt)).toEqual({ text: 'on budget', tone: 'muted' });
  });
});
