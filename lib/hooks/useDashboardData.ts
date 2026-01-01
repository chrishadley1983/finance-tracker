'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SummaryData {
  totalBalance: number;
  monthIncome: number;
  monthExpenses: number;
  monthNet: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: { name: string } | null;
}

export interface CategorySpend {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface UseDashboardDataResult {
  summary: SummaryData | null;
  recentTransactions: Transaction[];
  categorySpend: CategorySpend[];
  monthlyTrend: MonthlyData[];
  isLoading: boolean;
  error: string | null;
}

export function useDashboardData(): UseDashboardDataResult {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel (4 API calls max)
      const [summaryRes, transactionsRes, categoryRes, trendRes] = await Promise.all([
        fetch('/api/transactions/summary'),
        fetch('/api/transactions?limit=10'),
        fetch('/api/transactions/by-category'),
        fetch('/api/transactions/monthly-trend'),
      ]);

      // Check for errors
      if (!summaryRes.ok) {
        const err = await summaryRes.json();
        throw new Error(err.error || 'Failed to fetch summary');
      }
      if (!transactionsRes.ok) {
        const err = await transactionsRes.json();
        throw new Error(err.error || 'Failed to fetch transactions');
      }
      if (!categoryRes.ok) {
        const err = await categoryRes.json();
        throw new Error(err.error || 'Failed to fetch category data');
      }
      if (!trendRes.ok) {
        const err = await trendRes.json();
        throw new Error(err.error || 'Failed to fetch trend data');
      }

      // Parse responses
      const [summaryData, transactionsData, categoryData, trendData] = await Promise.all([
        summaryRes.json(),
        transactionsRes.json(),
        categoryRes.json(),
        trendRes.json(),
      ]);

      setSummary(summaryData);
      setRecentTransactions(transactionsData.data || []);
      setCategorySpend(categoryData);
      setMonthlyTrend(trendData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    summary,
    recentTransactions,
    categorySpend,
    monthlyTrend,
    isLoading,
    error,
  };
}
