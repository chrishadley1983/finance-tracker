'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  TransactionFilters,
  TransactionTable,
  TransactionPagination,
} from '@/components/transactions';
import { useTransactions, FilterState } from '@/lib/hooks/useTransactions';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { transactions, total, isLoading, error } = useTransactions({
    filters,
    page,
    pageSize,
    sortColumn,
    sortDirection,
  });

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const handleSort = useCallback((column: string) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setPage(1); // Reset to first page when sort changes
  }, [sortColumn]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1); // Reset to first page when page size changes
  }, []);

  return (
    <AppLayout title="Transactions">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Manage and view all your transactions
          </p>
        </div>

        {/* Filters */}
        <TransactionFilters filters={filters} onChange={handleFilterChange} />

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <TransactionTable
          transactions={transactions}
          isLoading={isLoading}
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
        />

        {/* Pagination */}
        <TransactionPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </AppLayout>
  );
}
