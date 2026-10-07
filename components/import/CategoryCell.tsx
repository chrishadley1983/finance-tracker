'use client';

import { useState, useRef, useEffect } from 'react';
import { CategoryConfidence, confidenceText } from './CategoryConfidence';
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
      <div className="flex min-w-0 items-center gap-1.5 text-ink-3">
        <span className="truncate">{result.categoryName || '-'}</span>
        <CategoryConfidence result={result} />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Display Mode */}
      <button
        onClick={() => setIsEditing(true)}
        className={`-mx-1.5 flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-sm transition-colors hover:bg-sunk focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          result.categoryId ? 'text-ink-2' : 'text-ink-3'
        }`}
        type="button"
        title={confidenceText(result)}
      >
        <span className="truncate">{result.categoryName || 'Uncategorised'}</span>
        <CategoryConfidence result={result} showTooltip={false} />
      </button>

      {/* Edit Mode - Dropdown */}
      {isEditing && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-surface rounded-md shadow-lg border border-line z-20 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-line-2">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search categories..."
              className="w-full px-2 py-1.5 text-sm border border-line rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="overflow-y-auto max-h-60">
            {/* Copy from above */}
            {onCopyFromAbove && (
              <div className="border-b border-line-2">
                <button
                  onClick={() => {
                    onCopyFromAbove();
                    setIsEditing(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-accent hover:bg-accent-soft flex items-center gap-2"
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
              <div className="border-b border-line-2">
                <div className="px-3 py-1.5 text-xs text-ink-3 bg-sunk">
                  Suggestions
                </div>
                {alternatives.map((alt) => (
                  <button
                    key={alt.categoryId}
                    onClick={() => handleSelect(alt.categoryId)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-sunk flex items-center justify-between"
                  >
                    <span>{alt.categoryName}</span>
                    <span className="text-xs text-ink-3">
                      {Math.round(alt.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Recent Categories */}
            {recentCats.length > 0 && !searchTerm && (
              <div className="border-b border-line-2">
                <div className="px-3 py-1.5 text-xs text-ink-3 bg-sunk">
                  Recent
                </div>
                {recentCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-sunk"
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
                  <div className="px-3 py-2 text-sm text-ink-3">
                    No categories found
                  </div>
                ) : (
                  filteredCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelect(cat.id)}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-sunk flex items-center justify-between"
                    >
                      <span>{cat.name}</span>
                      <span className="text-xs text-ink-3">
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
                  <div className="px-3 py-1.5 text-xs text-ink-3 bg-sunk sticky top-0">
                    {group}
                  </div>
                  {cats.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelect(cat.id)}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-sunk ${
                        cat.id === result.categoryId
                          ? 'bg-accent-soft text-accent'
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
