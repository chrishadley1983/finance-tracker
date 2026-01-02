'use client';

import { useState, useRef, useEffect } from 'react';
import { CategoryConfidence, SourceBadge } from './CategoryConfidence';
import type { CategorisationResult } from '@/lib/categorisation';

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface CategoryCellProps {
  result: CategorisationResult;
  categories: Category[];
  recentCategories?: string[]; // Category IDs used recently
  onCategoryChange: (categoryId: string, categoryName: string) => void;
  onCopyFromAbove?: () => void;
  disabled?: boolean;
}

/**
 * Category display/edit cell with confidence indicator.
 * Click to open dropdown for editing.
 */
export function CategoryCell({
  result,
  categories,
  recentCategories = [],
  onCategoryChange,
  onCopyFromAbove,
  disabled = false,
}: CategoryCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEditing(false);
        setSearchTerm('');
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

  // Focus search input when opening
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

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
    : categories;

  // Get recent categories that match search
  const recentCats = recentCategories
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Category => !!c)
    .filter(
      (c) =>
        !searchTerm ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 3);

  // Get alternatives from result
  const alternatives = result.alternatives?.slice(0, 3) || [];

  const handleSelect = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      onCategoryChange(categoryId, category.name);
    }
    setIsEditing(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setSearchTerm('');
    }
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <CategoryConfidence result={result} />
        <span className="truncate max-w-[150px]">
          {result.categoryName || '—'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Display Mode */}
      <button
        onClick={() => setIsEditing(true)}
        className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 transition-colors text-left w-full ${
          !result.categoryId ? 'text-slate-400 italic' : ''
        }`}
        type="button"
      >
        <CategoryConfidence result={result} />
        <span className="truncate max-w-[120px]">
          {result.categoryName || 'Uncategorised'}
        </span>
        <SourceBadge source={result.source} />
      </button>

      {/* Edit Mode - Dropdown */}
      {isEditing && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-20 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search categories..."
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="overflow-y-auto max-h-60">
            {/* Copy from above */}
            {onCopyFromAbove && (
              <div className="border-b border-slate-100">
                <button
                  onClick={() => {
                    onCopyFromAbove();
                    setIsEditing(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                  Same as above
                </button>
              </div>
            )}

            {/* Alternatives */}
            {alternatives.length > 0 && !searchTerm && (
              <div className="border-b border-slate-100">
                <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50">
                  Suggestions
                </div>
                {alternatives.map((alt) => (
                  <button
                    key={alt.categoryId}
                    onClick={() => handleSelect(alt.categoryId)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>{alt.categoryName}</span>
                    <span className="text-xs text-slate-400">
                      {Math.round(alt.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Recent Categories */}
            {recentCats.length > 0 && !searchTerm && (
              <div className="border-b border-slate-100">
                <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50">
                  Recent
                </div>
                {recentCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* All Categories (grouped or filtered) */}
            {searchTerm ? (
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
                      onClick={() => handleSelect(cat.id)}
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
                      onClick={() => handleSelect(cat.id)}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                        cat.id === result.categoryId
                          ? 'bg-blue-50 text-blue-700'
                          : ''
                      }`}
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
  );
}
