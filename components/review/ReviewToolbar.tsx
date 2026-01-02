'use client';

import { useState, useEffect } from 'react';
import { Tag, X, Filter } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  groupName: string;
}

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      setLoadingCategories(true);
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(
            data.map((c: { id: string; name: string; group_name: string }) => ({
              id: c.id,
              name: c.name,
              groupName: c.group_name,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  // Group categories by group_name
  const groupedCategories = categories.reduce(
    (acc, cat) => {
      if (!acc[cat.groupName]) {
        acc[cat.groupName] = [];
      }
      acc[cat.groupName].push(cat);
      return acc;
    },
    {} as Record<string, Category[]>
  );

  const handleCategorySelect = (categoryId: string) => {
    onCategorise(categoryId);
    setShowCategoryDropdown(false);
  };

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

            {/* Category Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                disabled={isProcessing || loadingCategories}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Tag className="h-4 w-4" />
                Categorise
              </button>

              {showCategoryDropdown && (
                <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  {Object.entries(groupedCategories).map(([group, cats]) => (
                    <div key={group}>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-500 uppercase sticky top-0">
                        {group}
                      </div>
                      {cats.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategorySelect(cat.id)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
