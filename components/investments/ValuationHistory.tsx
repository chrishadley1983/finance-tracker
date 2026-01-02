'use client';

import { useState, useEffect, useCallback } from 'react';
import { type ValuationWithChange } from '@/lib/types/investment';

interface ValuationHistoryProps {
  isOpen: boolean;
  accountId: string;
  accountName: string;
  onClose: () => void;
  onEdit: (valuation: ValuationWithChange) => void;
  onDelete: (valuationId: string) => Promise<void>;
  onBulkImport: () => void;
}

export function ValuationHistory({
  isOpen,
  accountId,
  accountName,
  onClose,
  onEdit,
  onDelete,
  onBulkImport,
}: ValuationHistoryProps) {
  const [valuations, setValuations] = useState<ValuationWithChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const fetchValuations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/investments/${accountId}/valuations?limit=${limit}&offset=${offset}`
      );
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();

      // Calculate changes
      const withChanges: ValuationWithChange[] = data.valuations.map(
        (v: ValuationWithChange, index: number, arr: ValuationWithChange[]) => {
          if (index === arr.length - 1) {
            return v; // No previous to compare
          }
          const previous = arr[index + 1];
          const change = v.value - previous.value;
          const changePercent = previous.value !== 0 ? (change / previous.value) * 100 : 0;
          return { ...v, change, changePercent };
        }
      );

      setValuations(withChanges);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch valuations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, offset]);

  useEffect(() => {
    if (isOpen) {
      fetchValuations();
    }
  }, [isOpen, fetchValuations]);

  const handleDelete = async (valuationId: string) => {
    if (!confirm('Delete this valuation?')) return;
    await onDelete(valuationId);
    fetchValuations();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={onClose}
        />

        {/* Dialog */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Valuation History</h2>
              <p className="text-sm text-gray-500">{accountName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onBulkImport}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
              >
                Import Historical Data
              </button>
              <button
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="animate-pulse space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded" />
                ))}
              </div>
            ) : valuations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No valuations recorded yet
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Value</th>
                    <th className="pb-2 font-medium text-right">Change</th>
                    <th className="pb-2 font-medium">Notes</th>
                    <th className="pb-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {valuations.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="py-3 text-sm">{formatDate(v.date)}</td>
                      <td className="py-3 text-sm text-right font-medium">
                        {formatCurrency(v.value)}
                      </td>
                      <td className="py-3 text-sm text-right">
                        {v.change !== undefined ? (
                          <span
                            className={
                              v.change >= 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {v.change >= 0 ? '+' : ''}
                            {formatCurrency(v.change)}
                            <span className="text-xs ml-1">
                              ({v.changePercent! >= 0 ? '+' : ''}
                              {v.changePercent!.toFixed(1)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 text-sm text-gray-500 max-w-32 truncate">
                        {v.notes || '-'}
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => onEdit(v)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
