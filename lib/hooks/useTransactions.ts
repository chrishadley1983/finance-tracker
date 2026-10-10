'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/** Status chip on the transactions page (maps to ?status= on the API). */
export type TransactionStatusFilter = 'uncategorised' | 'needs_review' | 'unvalidated' | 'validated';

export interface FilterState {
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  status?: TransactionStatusFilter;
  /** Legacy validation filter; prefer `status`. */
  validated?: 'all' | 'validated' | 'unvalidated';
}

export interface TransactionTotals {
  /** Money out across the filtered set, as a positive number. */
  out: number;
  /** Money in across the filtered set. */
  in: number;
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
  is_validated: boolean;
  needs_review: boolean;
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
  totals: TransactionTotals | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * API query params for a set of filters (shared by the list fetch and
 * GET /api/transactions/ids so both always describe the same rows).
 */
export function filterQueryParams(filters: FilterState, search = filters.search): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.accountId) params.set('account_id', filters.accountId);
  if (filters.categoryId) params.set('category_id', filters.categoryId);
  if (filters.dateFrom) params.set('start_date', filters.dateFrom);
  if (filters.dateTo) params.set('end_date', filters.dateTo);
  if (search) params.set('search', search);
  if (filters.status) params.set('status', filters.status);
  else if (filters.validated && filters.validated !== 'all') params.set('validated', filters.validated);
  return params;
}

export function useTransactions({
  filters,
  page,
  pageSize,
  sortColumn = 'date',
  sortDirection = 'desc',
}: UseTransactionsParams): UseTransactionsResult {
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<TransactionTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  // Ignore responses from superseded requests.
  const requestSeq = useRef(0);

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
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);

    try {
      const params = filterQueryParams(
        {
          accountId: filters.accountId,
          categoryId: filters.categoryId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          status: filters.status,
          validated: filters.validated,
        },
        debouncedSearch
      );

      params.set('limit', pageSize.toString());
      params.set('offset', ((page - 1) * pageSize).toString());
      params.set('sort_column', sortColumn);
      params.set('sort_direction', sortDirection);
      params.set('_t', Date.now().toString()); // Cache-buster

      const response = await fetch(`/api/transactions?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }

      const result = await response.json();
      if (seq !== requestSeq.current) return;
      setTransactions(result.data);
      setTotal(result.total);
      setTotals(result.totals ?? null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      setTransactions([]);
      setTotal(0);
      setTotals(null);
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [filters.accountId, filters.categoryId, filters.dateFrom, filters.dateTo, filters.status, filters.validated, debouncedSearch, page, pageSize, sortColumn, sortDirection]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    total,
    totals,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}
