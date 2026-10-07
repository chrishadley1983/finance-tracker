'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BudgetGroupComparison, SavingsRate } from '@/lib/types/budget';
import type { BudgetPeriod } from '@/lib/budgets/period';

export interface UseBudgetsReturn {
  groups: BudgetGroupComparison[];
  savingsRate: SavingsRate | null;
  /** True while the period's data is first loading (not during a quiet refresh). */
  isLoading: boolean;
  error: string | null;
  /** Re-fetch. `quiet` keeps the current rows on screen instead of showing the skeleton. */
  refresh: (opts?: { quiet?: boolean }) => Promise<void>;
  /** Set one category's budget locally (for optimistic edits); totals are recomputed. */
  setLocalBudget: (categoryId: string, amount: number) => void;
}

/** Replace one category's budget amount and recompute variances and group totals. */
export function patchBudget(groups: BudgetGroupComparison[], categoryId: string, amount: number): BudgetGroupComparison[] {
  return groups.map((g) => {
    if (!g.categories.some((c) => c.categoryId === categoryId)) return g;
    const categories = g.categories.map((c) =>
      c.categoryId === categoryId ? { ...c, budgetAmount: amount, variance: c.actualAmount - amount } : c
    );
    const budget = categories.reduce((s, c) => s + c.budgetAmount, 0);
    const actual = categories.reduce((s, c) => s + c.actualAmount, 0);
    return { ...g, categories, totals: { budget, actual, variance: actual - budget } };
  });
}

const noStore: RequestInit = { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } };

/** Budget vs actual and the savings summary for one month or one year. */
export function useBudgets(period: BudgetPeriod): UseBudgetsReturn {
  const year = period.year;
  const month = period.view === 'month' ? period.month : null;
  const [groups, setGroups] = useState<BudgetGroupComparison[]>([]);
  const [savingsRate, setSavingsRate] = useState<SavingsRate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncedYears = useRef(new Set<number>());
  const requestId = useRef(0);

  const fetchData = useCallback(
    async (opts: { quiet?: boolean } = {}) => {
      const id = ++requestId.current;
      if (!opts.quiet) setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(year) });
        if (month !== null) params.set('month', String(month));

        // Make sure every category has budget rows for this year. Only needed
        // once per year per visit, not on every month change or refresh.
        if (!syncedYears.current.has(year)) {
          const syncRes = await fetch('/api/budgets/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year }),
          });
          if (syncRes.ok) syncedYears.current.add(year);
        }

        const [comparisonRes, savingsRes] = await Promise.all([
          fetch(`/api/budgets/comparison?${params}`, noStore),
          fetch(`/api/budgets/savings-rate?${params}`, noStore),
        ]);
        if (!comparisonRes.ok) throw new Error('Could not load budgets for this period. Try again in a moment.');
        if (!savingsRes.ok) throw new Error('Could not load the income and savings summary. Try again in a moment.');
        const comparisonData = await comparisonRes.json();
        const savingsData = await savingsRes.json();
        if (id !== requestId.current) return; // a newer request has started
        setGroups(comparisonData.groups || []);
        setSavingsRate(savingsData.savingsRate || null);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Could not load budgets.');
      } finally {
        if (id === requestId.current) setIsLoading(false);
      }
    },
    [year, month]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const setLocalBudget = useCallback((categoryId: string, amount: number) => {
    setGroups((gs) => patchBudget(gs, categoryId, amount));
  }, []);

  return { groups, savingsRate, isLoading, error, refresh: fetchData, setLocalBudget };
}
