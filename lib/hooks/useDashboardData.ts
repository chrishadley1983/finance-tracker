'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TimeframePeriod } from '@/components/dashboard';

export interface SummaryData {
  totalBalance: number;
  periodIncome: number;
  periodExpenses: number;
  periodNet: number;
  period: TimeframePeriod;
  startDate: string;
  endDate: string;
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

export interface AccountTypeBalance {
  type: string;
  label: string;
  balance: number;
}

export interface AccountSummaryData {
  netWorth: number;
  accountTypeBalances: AccountTypeBalance[];
}

interface UseDashboardDataParams {
  period?: TimeframePeriod;
  customStart?: string;
  customEnd?: string;
}

interface UseDashboardDataResult {
  summary: SummaryData | null;
  accountSummary: AccountSummaryData | null;
  recentTransactions: Transaction[];
  categorySpend: CategorySpend[];
  incomeByCategory: CategorySpend[];
  monthlyTrend: MonthlyData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardData(params: UseDashboardDataParams = {}): UseDashboardDataResult {
  const { period = 'this_month', customStart, customEnd } = params;

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [accountSummary, setAccountSummary] = useState<AccountSummaryData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [incomeByCategory, setIncomeByCategory] = useState<CategorySpend[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query params for timeframe
      const timeframeParams = new URLSearchParams();
      timeframeParams.set('period', period);
      if (period === 'custom' && customStart && customEnd) {
        timeframeParams.set('start', customStart);
        timeframeParams.set('end', customEnd);
      }

      // Fetch all data in parallel (6 API calls)
      // Use cache-busting timestamp + no-store + no-cache headers to prevent stale data
      const timestamp = Date.now().toString();
      const fetchOptions: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      };

      // Add cache-buster to all params
      timeframeParams.set('_t', timestamp);

      // Build trend params - pass period for year-based views
      const trendParams = new URLSearchParams();
      if (period === 'last_year' || period === 'this_year') {
        trendParams.set('period', period);
      }
      trendParams.set('_t', timestamp);

      const [summaryRes, accountSummaryRes, transactionsRes, categoryRes, incomeRes, trendRes] = await Promise.all([
        fetch(`/api/transactions/summary?${timeframeParams.toString()}`, fetchOptions),
        fetch(`/api/accounts/summary?_t=${timestamp}`, fetchOptions),
        fetch(`/api/transactions?limit=10&_t=${timestamp}`, fetchOptions),
        fetch(`/api/transactions/by-category?${timeframeParams.toString()}`, fetchOptions),
        fetch(`/api/transactions/income-by-category?${timeframeParams.toString()}`, fetchOptions),
        fetch(`/api/transactions/monthly-trend?${trendParams.toString()}`, fetchOptions),
      ]);

      // Check for errors
      if (!summaryRes.ok) {
        const err = await summaryRes.json();
        throw new Error(err.error || 'Failed to fetch summary');
      }
      if (!accountSummaryRes.ok) {
        const err = await accountSummaryRes.json();
        throw new Error(err.error || 'Failed to fetch account summary');
      }
      if (!transactionsRes.ok) {
        const err = await transactionsRes.json();
        throw new Error(err.error || 'Failed to fetch transactions');
      }
      if (!categoryRes.ok) {
        const err = await categoryRes.json();
        throw new Error(err.error || 'Failed to fetch category data');
      }
      if (!incomeRes.ok) {
        const err = await incomeRes.json();
        throw new Error(err.error || 'Failed to fetch income data');
      }
      if (!trendRes.ok) {
        const err = await trendRes.json();
        throw new Error(err.error || 'Failed to fetch trend data');
      }

      // Parse responses
      const [summaryData, accountSummaryData, transactionsData, categoryData, incomeData, trendData] = await Promise.all([
        summaryRes.json(),
        accountSummaryRes.json(),
        transactionsRes.json(),
        categoryRes.json(),
        incomeRes.json(),
        trendRes.json(),
      ]);

      setSummary(summaryData);
      setAccountSummary(accountSummaryData);
      setRecentTransactions(transactionsData.data || []);
      setCategorySpend(categoryData);
      setIncomeByCategory(incomeData);
      setMonthlyTrend(trendData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    summary,
    accountSummary,
    recentTransactions,
    categorySpend,
    incomeByCategory,
    monthlyTrend,
    isLoading,
    error,
    refetch: fetchDashboardData,
  };
}
