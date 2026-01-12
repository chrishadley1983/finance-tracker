'use client';

import { CategoryWithStats } from '@/lib/types/category';

interface CategoryCardProps {
  category: CategoryWithStats;
  onEdit: (category: CategoryWithStats) => void;
  onDelete: (category: CategoryWithStats) => void;
}

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      className="group flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700
                 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Colour indicator */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: category.colour || '#94a3b8' }}
        />

        {/* Category name and stats */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {category.name}
            </span>
            {category.is_income && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                Income
              </span>
            )}
            {category.exclude_from_totals && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                Excluded
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {category.transaction_count} transactions
            {category.total_amount > 0 && (
              <span className="ml-2">{formatAmount(category.total_amount)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(category)}
          className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Edit category"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(category)}
          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Delete category"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
