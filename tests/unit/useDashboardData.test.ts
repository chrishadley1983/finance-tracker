import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSummary = {
  totalBalance: 5000,
  periodIncome: 3000,
  periodExpenses: 1500,
  periodNet: 1500,
  period: 'this_month',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
};

const mockAccountSummary = {
  netWorth: 10000,
  accountTypeBalances: [
    { type: 'current', label: 'Current', balance: 5000 },
    { type: 'savings', label: 'Savings', balance: 5000 },
  ],
};

const mockTransactions = {
  data: [
    { id: 'txn-1', date: '2025-01-15', amount: -50, description: 'Test', category: null },
  ],
};

const mockCategorySpend = [
  { categoryId: 'cat-1', categoryName: 'Groceries', amount: 500, percentage: 50 },
];

const mockIncomeByCategory = [
  { categoryId: 'cat-2', categoryName: 'Salary', amount: 3000, percentage: 100 },
];

const mockMonthlyTrend = [
  { month: 'Jan', income: 3000, expenses: 1500 },
];

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('initial state', () => {
    it('returns loading state initially', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.isLoading).toBe(true);
    });

    it('returns null summary initially', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.summary).toBeNull();
    });

    it('returns empty arrays initially', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.recentTransactions).toEqual([]);
      expect(result.current.categorySpend).toEqual([]);
      expect(result.current.monthlyTrend).toEqual([]);
    });

    it('returns no error initially', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDashboardData());

      expect(result.current.error).toBeNull();
    });
  });

  describe('successful data fetching', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSummary),
          });
        }
        if (url.includes('/api/accounts/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAccountSummary),
          });
        }
        if (url.includes('/api/transactions?') && url.includes('limit=10')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTransactions),
          });
        }
        if (url.includes('/api/transactions/by-category')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategorySpend),
          });
        }
        if (url.includes('/api/transactions/income-by-category')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIncomeByCategory),
          });
        }
        if (url.includes('/api/transactions/monthly-trend')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMonthlyTrend),
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      });
    });

    it('fetches all 6 endpoints', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(6);
      });
    });

    it('fetches summary endpoint with period', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: string[]) => c[0]);
        const summaryCall = calls.find((url: string) => url.includes('/api/transactions/summary'));
        expect(summaryCall).toBeDefined();
        expect(summaryCall).toContain('period=this_month');
      });
    });

    it('fetches transactions with limit', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: string[]) => c[0]);
        const txnCall = calls.find((url: string) => url.includes('/api/transactions?') && url.includes('limit=10'));
        expect(txnCall).toBeDefined();
      });
    });

    it('fetches by-category endpoint with period', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: string[]) => c[0]);
        const catCall = calls.find((url: string) => url.includes('/api/transactions/by-category'));
        expect(catCall).toBeDefined();
        expect(catCall).toContain('period=this_month');
      });
    });

    it('fetches monthly-trend endpoint', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: string[]) => c[0]);
        const trendCall = calls.find((url: string) => url.includes('/api/transactions/monthly-trend'));
        expect(trendCall).toBeDefined();
      });
    });

    it('fetches account summary endpoint', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: string[]) => c[0]);
        const accountCall = calls.find((url: string) => url.includes('/api/accounts/summary'));
        expect(accountCall).toBeDefined();
      });
    });

    it('fetches income-by-category endpoint', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: string[]) => c[0]);
        const incomeCall = calls.find((url: string) => url.includes('/api/transactions/income-by-category'));
        expect(incomeCall).toBeDefined();
      });
    });

    it('returns summary data after fetching', async () => {
      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summary).toEqual(mockSummary);
    });

    it('returns transactions data after fetching', async () => {
      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recentTransactions).toEqual(mockTransactions.data);
    });

    it('returns category spend data after fetching', async () => {
      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.categorySpend).toEqual(mockCategorySpend);
    });

    it('returns monthly trend data after fetching', async () => {
      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.monthlyTrend).toEqual(mockMonthlyTrend);
    });

    it('sets isLoading to false after fetching', async () => {
      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('handles summary API error', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions/summary')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Summary failed' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Summary failed');
    });

    it('handles transactions API error', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions?') && url.includes('limit=10')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Transactions failed' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The hook checks errors sequentially, so the first failing check determines the error.
      // accountSummary is checked before transactions, so if accountSummary also fails
      // we'd get that error. But here accountSummary returns ok:true with empty data.
      // However the hook checks: summaryRes, accountSummaryRes, transactionsRes in order.
      // Since the mock returns ok:true for accountSummary (default), transactionsRes error should be caught.
      expect(result.current.error).toBe('Transactions failed');
    });

    it('handles category API error', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions/by-category')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Category failed' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Category failed');
    });

    it('handles trend API error', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions/monthly-trend')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Trend failed' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Trend failed');
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('data shape', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSummary),
          });
        }
        if (url.includes('/api/accounts/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAccountSummary),
          });
        }
        if (url.includes('/api/transactions?') && url.includes('limit=10')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTransactions),
          });
        }
        if (url.includes('/api/transactions/by-category')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategorySpend),
          });
        }
        if (url.includes('/api/transactions/income-by-category')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockIncomeByCategory),
          });
        }
        if (url.includes('/api/transactions/monthly-trend')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMonthlyTrend),
          });
        }
        return Promise.reject(new Error('Unknown URL: ' + url));
      });
    });

    it('returns correct summary shape', async () => {
      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.summary).toHaveProperty('totalBalance');
      expect(result.current.summary).toHaveProperty('periodIncome');
      expect(result.current.summary).toHaveProperty('periodExpenses');
      expect(result.current.summary).toHaveProperty('periodNet');
      expect(result.current.summary).toHaveProperty('period');
      expect(result.current.summary).toHaveProperty('startDate');
      expect(result.current.summary).toHaveProperty('endDate');
    });

    it('handles missing data field in transactions response', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/transactions?') && url.includes('limit=10')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}), // No data field
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      const { result } = renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recentTransactions).toEqual([]);
    });
  });
});
