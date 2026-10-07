'use client';

import { Tag, X, Filter } from 'lucide-react';
import { CategorySelect } from '@/components/ui/CategorySelect';

interface ReviewToolbarProps {
  selectedCount: number;
  filter: 'all' | 'uncategorised' | 'flagged';
  onFilterChange: (filter: 'all' | 'uncategorised' | 'flagged') => void;
  onCategorise: (categoryId: string) => void;
  onClearSelection: () => void;
  onClearFlags: () => void;
  isProcessing?: boolean;
}

export function ReviewToolbar({
  selectedCount,
  filter,
  onFilterChange,
  onCategorise,
  onClearSelection,
  onClearFlags,
  isProcessing = false,
}: ReviewToolbarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => onFilterChange('all')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onFilterChange('uncategorised')}
              className={`px-3 py-1.5 text-sm font-medium border-l border-gray-200 dark:border-gray-700 transition-colors ${
                filter === 'uncategorised'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Uncategorised
            </button>
            <button
              onClick={() => onFilterChange('flagged')}
              className={`px-3 py-1.5 text-sm font-medium border-l border-gray-200 dark:border-gray-700 transition-colors ${
                filter === 'flagged'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Flagged
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} selected
            </span>

            {/* Category picker */}
            <CategorySelect
              variant="button"
              value={null}
              onChange={(categoryId) => {
                if (categoryId) onCategorise(categoryId);
              }}
              buttonLabel={
                <>
                  <Tag className="h-4 w-4" aria-hidden="true" />
                  Categorise
                </>
              }
              ariaLabel="Categorise selected"
              disabled={isProcessing}
              align="right"
            />

            {/* Clear Flags Button */}
            <button
              onClick={onClearFlags}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Clear Flags
            </button>

            {/* Clear Selection */}
            <button
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
