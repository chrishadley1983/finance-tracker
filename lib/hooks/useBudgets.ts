'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  BudgetGroupComparison,
  SavingsRate,
  BudgetViewMode,
} from '@/lib/types/budget';

interface UseBudgetsReturn {
  year: number;
  month: number | null;
  viewMode: BudgetViewMode;
  groups: BudgetGroupComparison[];
  savingsRate: SavingsRate | null;
  isLoading: boolean;
  error: string | null;
  setYear: (year: number) => void;
  setMonth: (month: number | null) => void;
  setViewMode: (mode: BudgetViewMode) => void;
  refresh: () => void;
}

export function useBudgets(): UseBudgetsReturn {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<BudgetViewMode>('month');
  const [groups, setGroups] = useState<BudgetGroupComparison[]>([]);
  const [savingsRate, setSavingsRate] = useState<SavingsRate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const queryMonth = viewMode === 'year' ? null : month;
      const params = new URLSearchParams({ year: String(year) });
      if (queryMonth !== null) {
        params.set('month', String(queryMonth));
      }

      // Fetch options to prevent caching
      const fetchOptions: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      };

      // First, sync budgets to ensure all categories have entries
      await fetch('/api/budgets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });

      // Then fetch the data
      const [comparisonRes, savingsRes] = await Promise.all([
        fetch(`/api/budgets/comparison?${params}`, fetchOptions),
        fetch(`/api/budgets/savings-rate?${params}`, fetchOptions),
      ]);

      if (!comparisonRes.ok) {
        throw new Error('Failed to fetch budget comparison');
      }
      if (!savingsRes.ok) {
        throw new Error('Failed to fetch savings rate');
      }

      const comparisonData = await comparisonRes.json();
      const savingsData = await savingsRes.json();

      setGroups(comparisonData.groups || []);
      setSavingsRate(savingsData.savingsRate || null);
    } catch (err) {
      console.error('Error fetching budget data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [year, month, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When view mode changes, update month accordingly
  const handleViewModeChange = useCallback((mode: BudgetViewMode) => {
    setViewMode(mode);
    if (mode === 'year') {
      // Keep month for when user switches back
    } else if (month === null) {
      setMonth(new Date().getMonth() + 1);
    }
  }, [month]);

  return {
    year,
    month: viewMode === 'year' ? null : month,
    viewMode,
    groups,
    savingsRate,
    isLoading,
    error,
    setYear,
    setMonth,
    setViewMode: handleViewModeChange,
    refresh: fetchData,
  };
}
