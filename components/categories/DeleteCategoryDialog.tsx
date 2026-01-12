'use client';

import { useState } from 'react';
import { CategoryWithStats } from '@/lib/types/category';

interface DeleteCategoryDialogProps {
  category: CategoryWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (force: boolean) => Promise<void>;
  onReassign: () => void;
}

export function DeleteCategoryDialog({
  category,
  isOpen,
  onClose,
  onDelete,
  onReassign,
}: DeleteCategoryDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !category) return null;

  const hasTransactions = category.transaction_count > 0;

  const handleDelete = async (force: boolean) => {
    setIsDeleting(true);
    setError(null);

    try {
      await onDelete(force);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Delete Category
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
            </div>
          )}

          <p className="text-slate-700 dark:text-slate-300 mb-4">
            Are you sure you want to delete <strong>{category.name}</strong>?
          </p>

          {hasTransactions && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    This category has transactions
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    {category.transaction_count} transactions totalling {formatAmount(category.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          {hasTransactions ? (
            <>
              <button
                type="button"
                onClick={onReassign}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                         hover:bg-blue-700 transition-colors"
              >
                Move Transactions First
              </button>
              <button
                type="button"
                onClick={() => handleDelete(true)}
                className="w-full px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400
                         border border-red-300 dark:border-red-700 rounded-md
                         hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Anyway (Uncategorise Transactions)'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                         border border-slate-300 dark:border-slate-600 rounded-md
                         hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                         border border-slate-300 dark:border-slate-600 rounded-md
                         hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md
                         hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
