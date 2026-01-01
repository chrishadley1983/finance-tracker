'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface FilterState {
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface TransactionWithRelations {
  id: string;
  date: string;
  amount: number;
  description: string;
  account_id: string;
  category_id: string | null;
  categorisation_source: string;
  hsbc_transaction_id: string | null;
  created_at: string;
  account: { name: string } | null;
  category: { name: string; group_name: string } | null;
}

interface UseTransactionsParams {
  filters: FilterState;
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}

interface UseTransactionsResult {
  transactions: TransactionWithRelations[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTransactions({
  filters,
  page,
  pageSize,
  sortColumn: _sortColumn,
  sortDirection: _sortDirection,
}: UseTransactionsParams): UseTransactionsResult {
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [filters.search]);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters.accountId) {
        params.set('account_id', filters.accountId);
      }
      if (filters.categoryId) {
        params.set('category_id', filters.categoryId);
      }
      if (filters.dateFrom) {
        params.set('start_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set('end_date', filters.dateTo);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      params.set('limit', pageSize.toString());
      params.set('offset', ((page - 1) * pageSize).toString());

      const response = await fetch(`/api/transactions?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }

      const result = await response.json();
      setTransactions(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setTransactions([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [filters.accountId, filters.categoryId, filters.dateFrom, filters.dateTo, debouncedSearch, page, pageSize]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    total,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}
