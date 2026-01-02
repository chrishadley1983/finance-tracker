'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flag, FlagOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReviewStats } from './ReviewStats';
import { ReviewToolbar } from './ReviewToolbar';

interface ReviewTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string;
  accountName: string;
  needsReview: boolean;
  createdAt: string;
}

interface ReviewQueueStats {
  total: number;
  uncategorised: number;
  flagged: number;
}

export function ReviewQueue() {
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [stats, setStats] = useState<ReviewQueueStats>({
    total: 0,
    uncategorised: 0,
    flagged: 0,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'uncategorised' | 'flagged'>(
    'all'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchReviewQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/transactions/review-queue?filter=${filter}&limit=${limit}&offset=${page * limit}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch review queue');
      }
      const data = await response.json();
      setTransactions(data.transactions);
      setStats(data.stats);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  const handleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleCategorise = async (categoryId: string) => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/transactions/review-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          categoryId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to categorise transactions');
      }

      setSelectedIds(new Set());
      await fetchReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to categorise');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearFlags = async () => {
    if (selectedIds.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/transactions/review-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          clearFlag: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to clear flags');
      }

      setSelectedIds(new Set());
      await fetchReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear flags');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleFlag = async (id: string, currentlyFlagged: boolean) => {
    try {
      const response = await fetch(`/api/transactions/${id}/flag`, {
        method: currentlyFlagged ? 'DELETE' : 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to toggle flag');
      }

      await fetchReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle flag');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <ReviewStats
        total={stats.total}
        uncategorised={stats.uncategorised}
        flagged={stats.flagged}
        isLoading={isLoading}
      />

      <ReviewToolbar
        selectedCount={selectedIds.size}
        filter={filter}
        onFilterChange={(f) => {
          setFilter(f);
          setPage(0);
          setSelectedIds(new Set());
        }}
        onCategorise={handleCategorise}
        onClearSelection={() => setSelectedIds(new Set())}
        onClearFlags={handleClearFlags}
        isProcessing={isProcessing}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === transactions.length &&
                      transactions.length > 0
                    }
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 ml-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
                    </td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No transactions to review
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedIds.has(transaction.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(transaction.id)}
                        onChange={() => handleSelectOne(transaction.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {transaction.accountName}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {transaction.categoryName ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {transaction.categoryName}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">
                          Uncategorised
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                        transaction.amount >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          handleToggleFlag(
                            transaction.id,
                            transaction.needsReview
                          )
                        }
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                          transaction.needsReview
                            ? 'text-amber-500'
                            : 'text-gray-400'
                        }`}
                        title={
                          transaction.needsReview
                            ? 'Remove flag'
                            : 'Flag for review'
                        }
                      >
                        {transaction.needsReview ? (
                          <Flag className="h-4 w-4" />
                        ) : (
                          <FlagOff className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {page * limit + 1} to{' '}
              {Math.min((page + 1) * limit, total)} of {total} transactions
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
