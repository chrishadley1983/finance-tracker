'use client';

import { useState } from 'react';
import { CategoryWithStats } from '@/lib/types/category';

interface ReassignCategoryDialogProps {
  category: CategoryWithStats | null;
  allCategories: CategoryWithStats[];
  isOpen: boolean;
  onClose: () => void;
  onReassign: (targetCategoryId: string) => Promise<void>;
}

export function ReassignCategoryDialog({
  category,
  allCategories,
  isOpen,
  onClose,
  onReassign,
}: ReassignCategoryDialogProps) {
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !category) return null;

  // Filter out the source category
  const availableCategories = allCategories.filter(c => c.id !== category.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetCategoryId) {
      setError('Please select a target category');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onReassign(targetCategoryId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reassign transactions');
    } finally {
      setIsSubmitting(false);
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

  // Group categories by their group for easier selection
  const groupedCategories = availableCategories.reduce((acc, cat) => {
    const groupName = cat.group_name || 'Ungrouped';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(cat);
    return acc;
  }, {} as Record<string, CategoryWithStats[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Move Transactions
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
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md">
                {error}
              </div>
            )}

            {/* Source info */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">Moving from:</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{category.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {category.transaction_count} transactions ({formatAmount(category.total_amount)})
              </p>
            </div>

            {/* Target category select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Move to:
              </label>
              <select
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a category...</option>
                {Object.entries(groupedCategories).map(([groupName, categories]) => (
                  <optgroup key={groupName} label={groupName}>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.transaction_count} transactions)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300
                       border border-slate-300 dark:border-slate-600 rounded-md
                       hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isSubmitting || !targetCategoryId}
            >
              {isSubmitting ? 'Moving...' : 'Move Transactions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
