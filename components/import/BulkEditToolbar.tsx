'use client';

import { useState, useRef, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface Category {
  id: string;
  name: string;
  group_name: string;
}

export interface BulkEditToolbarProps {
  selectedCount: number;
  totalCount: number;
  modifiedCount: number;
  skippedCount: number;
  categories: Category[];
  onSelectAll: () => void;
  onSelectNone: () => void;
  onBulkSetDate: (date: string) => void;
  onBulkSetCategory: (categoryId: string, categoryName: string) => void;
  onBulkAdjustAmount: (adjustment: { type: 'add' | 'subtract' | 'multiply'; value: number }) => void;
  onBulkSkip: () => void;
  onBulkDelete: () => void;
  onBulkReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

type OpenDropdown = 'date' | 'category' | 'amount' | null;

// =============================================================================
// COMPONENT
// =============================================================================

export function BulkEditToolbar({
  selectedCount,
  totalCount,
  modifiedCount,
  skippedCount,
  categories,
  onSelectAll,
  onSelectNone,
  onBulkSetDate,
  onBulkSetCategory,
  onBulkAdjustAmount,
  onBulkSkip,
  onBulkDelete,
  onBulkReset,
  onUndo,
  onRedo,
  onResetAll,
  canUndo,
  canRedo,
}: BulkEditToolbarProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [dateValue, setDateValue] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [amountType, setAmountType] = useState<'add' | 'subtract' | 'multiply'>('add');
  const [amountValue, setAmountValue] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
        setCategorySearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Filter categories
  const filteredCategories = categorySearch
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
          cat.group_name.toLowerCase().includes(categorySearch.toLowerCase())
      )
    : categories;

  // Group categories
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

  const handleDateApply = () => {
    if (dateValue) {
      onBulkSetDate(dateValue);
      setDateValue('');
      setOpenDropdown(null);
    }
  };

  const handleCategorySelect = (cat: Category) => {
    onBulkSetCategory(cat.id, cat.name);
    setCategorySearch('');
    setOpenDropdown(null);
  };

  const handleAmountApply = () => {
    const value = parseFloat(amountValue);
    if (!isNaN(value)) {
      onBulkAdjustAmount({ type: amountType, value });
      setAmountValue('');
      setOpenDropdown(null);
    }
  };

  const hasSelection = selectedCount > 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Selection Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={selectedCount === totalCount ? onSelectNone : onSelectAll}
            className="text-xs px-2 py-1 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
          >
            {selectedCount === totalCount ? 'Select none' : 'Select all'}
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

        {/* Bulk Edit Actions */}
        <div className="flex items-center gap-2" ref={dropdownRef}>
          {/* Set Date */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
              disabled={!hasSelection}
              className="text-sm px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Set Date
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'date' && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-20 p-3 w-56">
                <label className="block text-xs text-slate-500 mb-1">Apply date to {selectedCount} rows</label>
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleDateApply}
                  disabled={!dateValue}
                  className="mt-2 w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-blue-300"
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          {/* Set Category */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
              disabled={!hasSelection}
              className="text-sm px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Set Category
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'category' && (
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
                  {Object.entries(groupedCategories).length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">No categories found</div>
                  ) : (
                    Object.entries(groupedCategories).map(([group, cats]) => (
                      <div key={group}>
                        <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 sticky top-0">
                          {group}
                        </div>
                        {cats.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat)}
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

          {/* Adjust Amount */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'amount' ? null : 'amount')}
              disabled={!hasSelection}
              className="text-sm px-3 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Adjust Amount
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openDropdown === 'amount' && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-20 p-3 w-64">
                <label className="block text-xs text-slate-500 mb-2">Adjust amounts for {selectedCount} rows</label>
                <div className="flex gap-2 mb-2">
                  <select
                    value={amountType}
                    onChange={(e) => setAmountType(e.target.value as 'add' | 'subtract' | 'multiply')}
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="add">Add (+)</option>
                    <option value="subtract">Subtract (-)</option>
                    <option value="multiply">Multiply (%)</option>
                  </select>
                  <input
                    type="number"
                    value={amountValue}
                    onChange={(e) => setAmountValue(e.target.value)}
                    placeholder={amountType === 'multiply' ? '10 for 10%' : '0.00'}
                    step="0.01"
                    className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  {amountType === 'add' && 'Add a fixed amount to each selected row'}
                  {amountType === 'subtract' && 'Subtract a fixed amount from each selected row'}
                  {amountType === 'multiply' && 'Adjust by percentage (e.g., 10 = +10%)'}
                </p>
                <button
                  onClick={handleAmountApply}
                  disabled={!amountValue || isNaN(parseFloat(amountValue))}
                  className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-blue-300"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-300" />

        {/* Row Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBulkSkip}
            disabled={!hasSelection}
            className="text-sm px-3 py-1.5 text-slate-600 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Skip selected rows (won't be imported)"
          >
            Skip
          </button>
          <button
            onClick={onBulkDelete}
            disabled={!hasSelection}
            className="text-sm px-3 py-1.5 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete selected rows from import"
          >
            Delete
          </button>
          <button
            onClick={onBulkReset}
            disabled={!hasSelection}
            className="text-sm px-3 py-1.5 text-slate-600 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset selected rows to original values"
          >
            Reset
          </button>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-300" />

        {/* Undo/Redo/Reset All */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="text-sm px-2 py-1.5 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="text-sm px-2 py-1.5 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
          <button
            onClick={onResetAll}
            disabled={modifiedCount === 0 && skippedCount === 0}
            className="text-sm px-3 py-1.5 text-slate-600 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset all changes"
          >
            Reset All
          </button>
        </div>

        {/* Status Indicators */}
        {(modifiedCount > 0 || skippedCount > 0) && (
          <>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-3 text-sm">
              {modifiedCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                  {modifiedCount} modified
                </span>
              )}
              {skippedCount > 0 && (
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2 h-2 bg-slate-400 rounded-full" />
                  {skippedCount} skipped
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
