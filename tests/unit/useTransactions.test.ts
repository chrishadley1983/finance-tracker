import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransactions } from '@/lib/hooks/useTransactions';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockTransactions = [
  {
    id: 'txn-1',
    date: '2025-01-15',
    amount: -50.00,
    description: 'Groceries',
    account_id: 'acc-1',
    category_id: 'cat-1',
    categorisation_source: 'manual',
    hsbc_transaction_id: null,
    created_at: '2025-01-15T10:00:00Z',
    account: { name: 'HSBC Current' },
    category: { name: 'Groceries', group_name: 'Food' },
  },
  {
    id: 'txn-2',
    date: '2025-01-14',
    amount: 1500.00,
    description: 'Salary',
    account_id: 'acc-1',
    category_id: 'cat-2',
    categorisation_source: 'manual',
    hsbc_transaction_id: null,
    created_at: '2025-01-14T09:00:00Z',
    account: { name: 'HSBC Current' },
    category: { name: 'Salary', group_name: 'Income' },
  },
];

describe('useTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockTransactions, total: 2 }),
    });
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('initial state', () => {
    it('starts with loading true', () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('starts with empty transactions', () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      expect(result.current.transactions).toEqual([]);
    });

    it('starts with total of 0', () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      expect(result.current.total).toBe(0);
    });

    it('starts with no error', () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      expect(result.current.error).toBeNull();
    });
  });

  describe('data fetching', () => {
    it('fetches transactions on mount', async () => {
      renderHook(() => useTransactions({ filters: {}, page: 1, pageSize: 25 }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('returns fetched transactions', async () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.transactions).toEqual(mockTransactions);
      });
    });

    it('returns total count', async () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.total).toBe(2);
      });
    });

    it('sets loading to false after fetch', async () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('URL construction', () => {
    it('includes pagination params', async () => {
      renderHook(() => useTransactions({ filters: {}, page: 2, pageSize: 50 }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('limit=50');
        expect(url).toContain('offset=50');
      });
    });

    it('includes account filter', async () => {
      renderHook(() =>
        useTransactions({
          filters: { accountId: 'acc-123' },
          page: 1,
          pageSize: 25,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('account_id=acc-123');
      });
    });

    it('includes category filter', async () => {
      renderHook(() =>
        useTransactions({
          filters: { categoryId: 'cat-456' },
          page: 1,
          pageSize: 25,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('category_id=cat-456');
      });
    });

    it('includes date range filters', async () => {
      renderHook(() =>
        useTransactions({
          filters: { dateFrom: '2025-01-01', dateTo: '2025-01-31' },
          page: 1,
          pageSize: 25,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const url = mockFetch.mock.calls[0][0];
        expect(url).toContain('start_date=2025-01-01');
        expect(url).toContain('end_date=2025-01-31');
      });
    });

    it('does not include undefined filters', async () => {
      renderHook(() =>
        useTransactions({
          filters: { accountId: undefined },
          page: 1,
          pageSize: 25,
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const url = mockFetch.mock.calls[0][0];
        expect(url).not.toContain('account_id');
      });
    });
  });

  describe('error handling', () => {
    it('sets error on failed response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Database error' }),
      });

      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Database error');
      });
    });

    it('sets default error message when no error in response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch transactions');
      });
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('clears transactions on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.transactions).toEqual([]);
        expect(result.current.total).toBe(0);
      });
    });

    it('sets loading false on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('refetch', () => {
    it('provides refetch function', () => {
      const { result } = renderHook(() =>
        useTransactions({ filters: {}, page: 1, pageSize: 25 })
      );

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('parameter changes', () => {
    it('refetches when page changes', async () => {
      const { rerender } = renderHook(
        ({ page }) => useTransactions({ filters: {}, page, pageSize: 25 }),
        { initialProps: { page: 1 } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ page: 2 });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('refetches when pageSize changes', async () => {
      const { rerender } = renderHook(
        ({ pageSize }) => useTransactions({ filters: {}, page: 1, pageSize }),
        { initialProps: { pageSize: 25 } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ pageSize: 50 });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('refetches when filters change', async () => {
      const { rerender } = renderHook(
        ({ filters }) => useTransactions({ filters, page: 1, pageSize: 25 }),
        { initialProps: { filters: {} } }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ filters: { accountId: 'acc-1' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});
