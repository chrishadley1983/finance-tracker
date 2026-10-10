import { describe, it, expect } from 'vitest';
import {
  budgetTotals,
  listNames,
  periodFromSearchParams,
  periodProgress,
  periodToQueryString,
  remainingWords,
  stepPeriod,
  switchView,
} from '@/lib/budgets/period';
import { patchBudget } from '@/lib/hooks/useBudgets';
import { parseAmount } from '@/components/budgets/BudgetAmount';
import type { BudgetGroupComparison } from '@/lib/types/budget';

const NOW = new Date(2026, 9, 7, 12); // 7 Oct 2026
const qs = (s: string) => new URLSearchParams(s);

describe('budget period <-> URL', () => {
  it('reads ?month=YYYY-MM', () => {
    expect(periodFromSearchParams(qs('month=2026-09'), NOW)).toEqual({ view: 'month', year: 2026, month: 9 });
  });
  it('reads ?year=YYYY&view=year', () => {
    expect(periodFromSearchParams(qs('year=2025&view=year'), NOW)).toEqual({ view: 'year', year: 2025 });
  });
  it('falls back to the current month for missing or malformed params', () => {
    const current = { view: 'month', year: 2026, month: 10 };
    expect(periodFromSearchParams(qs(''), NOW)).toEqual(current);
    expect(periodFromSearchParams(qs('month=2026-13'), NOW)).toEqual(current);
    expect(periodFromSearchParams(qs('month=oops'), NOW)).toEqual(current);
    expect(periodFromSearchParams(null, NOW)).toEqual(current);
    expect(periodFromSearchParams(qs('view=year&year=abc'), NOW)).toEqual({ view: 'year', year: 2026 });
  });
  it('round-trips through the query string', () => {
    for (const p of [{ view: 'month', year: 2026, month: 1 } as const, { view: 'year', year: 2024 } as const]) {
      expect(periodFromSearchParams(qs(periodToQueryString(p)), NOW)).toEqual(p);
    }
    expect(periodToQueryString({ view: 'month', year: 2026, month: 3 })).toBe('month=2026-03');
    expect(periodToQueryString({ view: 'year', year: 2026 })).toBe('year=2026&view=year');
  });
  it('steps across year boundaries and switches view', () => {
    expect(stepPeriod({ view: 'month', year: 2026, month: 1 }, -1)).toEqual({ view: 'month', year: 2025, month: 12 });
    expect(stepPeriod({ view: 'month', year: 2025, month: 12 }, 1)).toEqual({ view: 'month', year: 2026, month: 1 });
    expect(stepPeriod({ view: 'year', year: 2026 }, 1)).toEqual({ view: 'year', year: 2027 });
    expect(switchView({ view: 'month', year: 2026, month: 3 }, 'year', NOW)).toEqual({ view: 'year', year: 2026 });
    expect(switchView({ view: 'year', year: 2026 }, 'month', NOW)).toEqual({ view: 'month', year: 2026, month: 10 });
    expect(switchView({ view: 'year', year: 2024 }, 'month', NOW)).toEqual({ view: 'month', year: 2024, month: 1 });
  });
});

describe('periodProgress', () => {
  it('gives pace and days left for the current month', () => {
    const p = periodProgress({ view: 'month', year: 2026, month: 10 }, NOW);
    expect(p.timing).toBe('current');
    expect(p.remaining).toBe(24);
    expect(p.pace).toBeCloseTo(7 / 31);
  });
  it('has no pace for past or future months', () => {
    expect(periodProgress({ view: 'month', year: 2026, month: 9 }, NOW)).toEqual({ timing: 'past' });
    expect(periodProgress({ view: 'month', year: 2026, month: 11 }, NOW)).toEqual({ timing: 'future' });
  });
  it('counts months left in the current year', () => {
    expect(periodProgress({ view: 'year', year: 2026 }, NOW).remaining).toBe(2);
  });
});

const groups: BudgetGroupComparison[] = [
  {
    groupName: 'Food',
    isIncome: false,
    categories: [
      { categoryId: 'a', categoryName: 'Eating out', groupName: 'Food', isIncome: false, budgetAmount: 250, actualAmount: 286, variance: 36 },
      { categoryId: 'b', categoryName: 'Groceries', groupName: 'Food', isIncome: false, budgetAmount: 600, actualAmount: 412, variance: -188 },
    ],
    totals: { budget: 850, actual: 698, variance: -152 },
  },
  {
    groupName: 'Kids',
    isIncome: false,
    categories: [{ categoryId: 'c', categoryName: 'Kids', groupName: 'Kids', isIncome: false, budgetAmount: 100, actualAmount: 180, variance: 80 }],
    totals: { budget: 100, actual: 180, variance: 80 },
  },
  {
    groupName: 'Income',
    isIncome: true,
    categories: [{ categoryId: 'd', categoryName: 'Salary', groupName: 'Income', isIncome: true, budgetAmount: 5000, actualAmount: 5000, variance: 0 }],
    totals: { budget: 5000, actual: 5000, variance: 0 },
  },
];

describe('budget figures', () => {
  it('totals spending (not income) and lists overspends, worst first', () => {
    const t = budgetTotals(groups);
    expect(t.spent).toBe(878);
    expect(t.planned).toBe(950);
    expect(t.income).toBe(5000);
    expect(t.over.map((c) => c.categoryName)).toEqual(['Kids', 'Eating out']);
  });
  it('joins names in plain English', () => {
    expect(listNames(['A'])).toBe('A');
    expect(listNames(['A', 'B'])).toBe('A and B');
    expect(listNames(['A', 'B', 'C'])).toBe('A, B and C');
    expect(listNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B and 3 more');
  });
  it('words what is left or over', () => {
    const f = (n: number) => `£${n}`;
    expect(remainingWords({ budgetAmount: 600, actualAmount: 186, isIncome: false }, f)).toEqual({ text: '£414 left', tone: 'muted' });
    expect(remainingWords({ budgetAmount: 250, actualAmount: 286, isIncome: false }, f)).toEqual({ text: '£36 over', tone: 'bad' });
    expect(remainingWords({ budgetAmount: 0, actualAmount: 20, isIncome: false }, f).tone).toBe('bad');
    expect(remainingWords({ budgetAmount: 100, actualAmount: 150, isIncome: true }, f)).toEqual({ text: '£50 more than planned', tone: 'in' });
  });
  it('patches one budget and recomputes the group totals', () => {
    const next = patchBudget(groups, 'a', 300);
    expect(next[0].categories[0]).toMatchObject({ budgetAmount: 300, variance: -14 });
    expect(next[0].totals).toEqual({ budget: 900, actual: 698, variance: -202 });
    expect(next[1]).toBe(groups[1]);
  });
  it('parses typed amounts', () => {
    expect(parseAmount('£1,250.50')).toBe(1250.5);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
  });
});
