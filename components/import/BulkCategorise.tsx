'use client';

import { useState, useRef, useEffect } from 'react';

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface BulkCategoriseProps {
  selectedCount: number;
  totalCount: number;
  uncategorisedCount: number;
  lowConfidenceCount: number;
  categories: Category[];
  onBulkAssign: (categoryId: string, categoryName: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSelectUncategorised: () => void;
  onSelectLowConfidence: () => void;
  onRecategorise: () => void;
  isRecategorising?: boolean;
}

/**
 * Toolbar for bulk categorisation actions.
 */
export function BulkCategorise({
  selectedCount,
  totalCount,
  uncategorisedCount,
  lowConfidenceCount,
  categories,
  onBulkAssign,
  onSelectAll,
  onSelectNone,
  onSelectUncategorised,
  onSelectLowConfidence,
  onRecategorise,
  isRecategorising = false,
}: BulkCategoriseProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSearchTerm('');
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Focus search input when opening
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showDropdown]);

  // Group categories by group_name
  const groupedCategories = categories.reduce(
    (acc, cat) => {
      if (!acc[cat.group_name]) {
        acc[cat.group_name] = [];
      }
      acc[cat.group_name].push(cat);
      return acc;
    },
    {} as Record<string, Category[]>
  );

  // Filter categories by search term
  const filteredCategories = searchTerm
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cat.group_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : null;

  const handleSelect = (categoryId: string, categoryName: string) => {
    onBulkAssign(categoryId, categoryName);
    setShowDropdown(false);
    setSearchTerm('');
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Selection Info */}
        <div className="text-sm text-slate-600">
          {selectedCount > 0 ? (
            <span className="font-medium">{selectedCount} selected</span>
          ) : (
            <span>Select rows to bulk edit</span>
          )}
        </div>

        {/* Quick Select Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={selectedCount === totalCount ? onSelectNone : onSelectAll}
            className="text-xs px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
          >
            {selectedCount === totalCount ? 'Select none' : 'Select all'}
          </button>
          {uncategorisedCount > 0 && (
            <button
              onClick={onSelectUncategorised}
              className="text-xs px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
            >
              Uncategorised ({uncategorisedCount})
            </button>
          )}
          {lowConfidenceCount > 0 && (
            <button
              onClick={onSelectLowConfidence}
              className="text-xs px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
            >
              Low confidence ({lowConfidenceCount})
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-300" />

        {/* Bulk Assign Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={selectedCount === 0}
            className="text-sm px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Set category to...
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-20 max-h-80 overflow-hidden">
              {/* Search Input */}
              <div className="p-2 border-b border-slate-100">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="overflow-y-auto max-h-60">
                {filteredCategories ? (
                  // Flat list when searching
                  <div>
                    {filteredCategories.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        No categories found
                      </div>
                    ) : (
                      filteredCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleSelect(cat.id, cat.name)}
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                        >
                          <span>{cat.name}</span>
                          <span className="text-xs text-slate-400">
                            {cat.group_name}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  // Grouped when not searching
                  Object.entries(groupedCategories).map(([group, cats]) => (
                    <div key={group}>
                      <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 sticky top-0">
                        {group}
                      </div>
                      {cats.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleSelect(cat.id, cat.name)}
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

        {/* Re-categorise with AI Button */}
        <button
          onClick={onRecategorise}
          disabled={selectedCount === 0 || isRecategorising}
          className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isRecategorising ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Re-categorising...
            </>
          ) : (
            <>
              <span className="text-base">✨</span>
              Re-categorise with AI
            </>
          )}
        </button>
      </div>
    </div>
  );
}
