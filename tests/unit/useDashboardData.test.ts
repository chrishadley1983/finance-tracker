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

const mockTransactions = {
  data: [
    { id: 'txn-1', date: '2025-01-15', amount: -50, description: 'Test', category: null },
  ],
};

const mockCategorySpend = [
  { categoryId: 'cat-1', categoryName: 'Groceries', amount: 500, percentage: 50 },
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
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSummary),
          });
        }
        if (url.includes('/transactions') && url.includes('limit=10')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTransactions),
          });
        }
        if (url.includes('/by-category')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategorySpend),
          });
        }
        if (url.includes('/monthly-trend')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMonthlyTrend),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('fetches all 4 endpoints', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });
    });

    it('fetches summary endpoint with period', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/transactions/summary?period=this_month');
      });
    });

    it('fetches transactions with limit', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/transactions?limit=10');
      });
    });

    it('fetches by-category endpoint with period', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/transactions/by-category?period=this_month');
      });
    });

    it('fetches monthly-trend endpoint', async () => {
      renderHook(() => useDashboardData());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/transactions/monthly-trend');
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
        if (url.includes('/summary')) {
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
        if (url.includes('/transactions') && url.includes('limit=10')) {
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

      expect(result.current.error).toBe('Transactions failed');
    });

    it('handles category API error', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/by-category')) {
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
        if (url.includes('/monthly-trend')) {
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
        if (url.includes('/summary')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSummary),
          });
        }
        if (url.includes('/transactions') && url.includes('limit=10')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockTransactions),
          });
        }
        if (url.includes('/by-category')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCategorySpend),
          });
        }
        if (url.includes('/monthly-trend')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockMonthlyTrend),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
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
        if (url.includes('/transactions') && url.includes('limit=10')) {
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
