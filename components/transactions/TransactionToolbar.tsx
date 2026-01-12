'use client';

import { useState, useRef, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface TransactionToolbarProps {
  selectedCount: number;
  totalCount: number;
  categories: Category[];
  onSelectAll: () => void;
  onSelectNone: () => void;
  onBulkSetCategory: (categoryId: string) => void;
  onBulkDelete: () => void;
  onAddTransaction: () => void;
}

export function TransactionToolbar({
  selectedCount,
  totalCount,
  categories,
  onSelectAll,
  onSelectNone,
  onBulkSetCategory,
  onBulkDelete,
  onAddTransaction,
}: TransactionToolbarProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showCategoryDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
        setCategorySearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown]);

  // Filter and group categories
  const filteredCategories = categorySearch
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
          cat.group_name.toLowerCase().includes(categorySearch.toLowerCase())
      )
    : categories;

  const groupedCategories = filteredCategories.reduce(
    (acc, cat) => {
      if (!acc[cat.group_name]) {
        acc[cat.group_name] = [];
      }
      acc[cat.group_name].push(cat);
      return acc;
    },
    {} as Record<string, Category[]>
  );

  const handleCategorySelect = (categoryId: string) => {
    onBulkSetCategory(categoryId);
    setShowCategoryDropdown(false);
    setCategorySearch('');
  };

  const hasSelection = selectedCount > 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Selection Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={selectedCount === totalCount && totalCount > 0 ? onSelectNone : onSelectAll}
            className="text-xs px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
          >
            {selectedCount === totalCount && totalCount > 0 ? 'Select none' : 'Select all'}
          </button>
          <span className="text-sm text-slate-600">
            {selectedCount > 0 ? (
              <span className="font-medium">{selectedCount} selected</span>
            ) : (
              'No selection'
            )}
            <span className="text-slate-400 ml-1">of {totalCount}</span>
          </span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-300" />

        {/* Bulk Actions */}
        <div className="flex items-center gap-2" ref={dropdownRef}>
          {/* Set Category */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={!hasSelection}
              className="text-sm px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Set Category
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCategoryDropdown && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-20 w-64 max-h-80 overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-60">
                  {/* Option to clear category */}
                  <button
                    onClick={() => handleCategorySelect('')}
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                  >
                    Remove category
                  </button>
                  {Object.entries(groupedCategories).length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
                  ) : (
                    Object.entries(groupedCategories).map(([group, cats]) => (
                      <div key={group}>
                        <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 sticky top-0 font-medium">
                          {group}
                        </div>
                        {cats.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat.id)}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={onBulkDelete}
            disabled={!hasSelection}
            className="text-sm px-3 py-1.5 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected
          </button>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-300" />

        {/* Add Transaction */}
        <button
          onClick={onAddTransaction}
          className="text-sm px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Transaction
        </button>
      </div>
    </div>
  );
}
