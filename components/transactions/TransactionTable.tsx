'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TransactionWithRelations } from '@/lib/hooks/useTransactions';

interface Category {
  id: string;
  name: string;
  group_name: string;
}

export interface TransactionWithRunningBalance extends TransactionWithRelations {
  running_balance?: number | null;
}

interface TransactionTableProps {
  transactions: TransactionWithRunningBalance[];
  isLoading: boolean;
  onSort: (column: string) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  onEdit?: (transaction: TransactionWithRelations) => void;
  onDelete?: (transaction: TransactionWithRelations) => void;
  onValidate?: (transaction: TransactionWithRelations) => void;
  categories?: Category[];
  onInlineUpdate?: (id: string, field: 'description' | 'category_id', value: string | null) => Promise<void>;
  showRunningBalance?: boolean;
  hideAccountColumn?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}

function SortIcon({ column, sortColumn, sortDirection }: { column: string; sortColumn: string; sortDirection: 'asc' | 'desc' }) {
  if (sortColumn !== column) {
    return (
      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }

  if (sortDirection === 'asc') {
    return (
      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3 w-10">
        <div className="h-4 w-4 bg-slate-200 rounded"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-48"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-32"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-slate-200 rounded w-28"></div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div>
      </td>
      <td className="px-4 py-3 w-24">
        <div className="h-4 bg-slate-200 rounded w-16"></div>
      </td>
    </tr>
  );
}

// Inline editable description component
function EditableDescription({
  value,
  transactionId,
  onSave,
}: {
  value: string;
  transactionId: string;
  onSave: (id: string, value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = async () => {
    if (editValue.trim() === value) {
      setIsEditing(false);
      return;
    }

    if (!editValue.trim()) {
      setEditValue(value);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(transactionId, editValue.trim());
      setIsEditing(false);
    } catch {
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className="w-full px-2 py-1 text-sm border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="max-w-md truncate cursor-pointer hover:bg-slate-100 px-2 py-1 -mx-2 -my-1 rounded transition-colors"
      title={`${value} (click to edit)`}
    >
      {value}
    </div>
  );
}

// Inline editable category component with search
function EditableCategory({
  category,
  transactionId,
  categories,
  onSave,
}: {
  category: { name: string; group_name: string } | null;
  transactionId: string;
  categories: Category[];
  onSave: (id: string, categoryId: string | null) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      setSearchTerm('');
      setHighlightedIndex(0);

      // Calculate dropdown position based on input position
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [isEditing]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  // Filter categories based on search term
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.group_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group filtered categories by group_name
  const groupedCategories = filteredCategories.reduce((acc, cat) => {
    if (!acc[cat.group_name]) {
      acc[cat.group_name] = [];
    }
    acc[cat.group_name].push(cat);
    return acc;
  }, {} as Record<string, Category[]>);

  // Flatten for keyboard navigation
  const flattenedOptions: (Category | null)[] = [
    null, // Uncategorized option
    ...filteredCategories,
  ];

  const handleSelect = async (categoryId: string | null) => {
    const currentCategoryId = categories.find(c => c.name === category?.name)?.id || null;

    if (categoryId === currentCategoryId) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(transactionId, categoryId);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, flattenedOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = flattenedOptions[highlightedIndex];
      handleSelect(selected?.id || null);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    } else if (e.key === 'Tab') {
      setIsEditing(false);
    }
  };

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  if (isEditing) {
    const dropdown = (
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: dropdownPosition.top - window.scrollY,
          left: dropdownPosition.left,
          zIndex: 9999,
        }}
        className="w-64 max-h-60 overflow-auto bg-white border border-slate-200 rounded-md shadow-lg"
      >
        {/* Uncategorized option */}
        <div
          onClick={() => handleSelect(null)}
          className={`px-3 py-2 text-sm cursor-pointer ${
            highlightedIndex === 0 ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'
          }`}
        >
          <span className="text-slate-400 italic">Uncategorized</span>
        </div>

        {Object.entries(groupedCategories).map(([groupName, cats]) => (
          <div key={groupName}>
            <div className="px-3 py-1 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
              {groupName}
            </div>
            {cats.map((cat) => {
              const optionIndex = flattenedOptions.findIndex(o => o?.id === cat.id);
              const isHighlighted = optionIndex === highlightedIndex;
              const isCurrentCategory = category?.name === cat.name;

              return (
                <div
                  key={cat.id}
                  onClick={() => handleSelect(cat.id)}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                    isHighlighted ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'
                  }`}
                >
                  <span>{cat.name}</span>
                  {isCurrentCategory && (
                    <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {filteredCategories.length === 0 && searchTerm && (
          <div className="px-3 py-2 text-sm text-slate-400 italic">
            No categories match "{searchTerm}"
          </div>
        )}
      </div>
    );

    return (
      <div ref={containerRef}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          placeholder="Search categories..."
          className="w-48 px-2 py-1 text-sm border border-emerald-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
        {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-slate-100 px-2 py-1 -mx-2 -my-1 rounded transition-colors inline-block"
      title="Click to change category"
    >
      {category ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {category.name}
        </span>
      ) : (
        <span className="text-slate-400">Uncategorized</span>
      )}
    </div>
  );
}

export function TransactionTable({
  transactions,
  isLoading,
  onSort,
  sortColumn,
  sortDirection,
  selectedIds = new Set(),
  onSelectionChange,
  onEdit,
  onDelete,
  onValidate,
  categories = [],
  onInlineUpdate,
  showRunningBalance = false,
  hideAccountColumn = false,
}: TransactionTableProps) {
  const hasSelection = onSelectionChange !== undefined;
  const hasActions = onEdit || onDelete || onValidate;
  const hasInlineEdit = onInlineUpdate !== undefined && categories.length > 0;

  const handleDescriptionSave = async (id: string, value: string) => {
    if (onInlineUpdate) {
      await onInlineUpdate(id, 'description', value);
    }
  };

  const handleCategorySave = async (id: string, categoryId: string | null) => {
    if (onInlineUpdate) {
      await onInlineUpdate(id, 'category_id', categoryId);
    }
  };

  const baseColumns = [
    { key: 'date', label: 'Date', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    ...(hideAccountColumn ? [] : [{ key: 'account', label: 'Account', sortable: true }]),
    { key: 'category', label: 'Category', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' as const },
    ...(showRunningBalance ? [{ key: 'balance', label: 'Balance', sortable: false, align: 'right' as const }] : []),
  ];
  const columns = baseColumns;

  const handleHeaderClick = (column: string, sortable: boolean) => {
    if (sortable) {
      onSort(column);
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedIds.size === transactions.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    if (!onSelectionChange) return;

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < transactions.length;

  if (!isLoading && transactions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-lg font-medium text-slate-900">No transactions found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or search terms</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {/* Checkbox column */}
              {hasSelection && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleHeaderClick(column.key, column.sortable)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-slate-100 select-none' : ''
                  } ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'right' ? 'justify-end' : ''}`}>
                    <span>{column.label}</span>
                    {column.sortable && (
                      <SortIcon column={column.key} sortColumn={sortColumn} sortDirection={sortDirection} />
                    )}
                  </div>
                </th>
              ))}
              {/* Actions column */}
              {hasActions && (
                <th className="px-4 py-3 w-28 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : (
              transactions.map((transaction) => {
                const isSelected = selectedIds.has(transaction.id);
                const isValidated = transaction.is_validated;
                // Row styling: selected takes priority, then validated, then default
                const rowClassName = isSelected
                  ? 'bg-emerald-50 hover:bg-emerald-100'
                  : isValidated
                  ? 'bg-green-100 hover:bg-green-200'
                  : 'hover:bg-slate-50';
                return (
                  <tr
                    key={transaction.id}
                    className={`transition-colors ${rowClassName}`}
                  >
                    {/* Checkbox */}
                    {hasSelection && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(transaction.id)}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {hasInlineEdit ? (
                        <EditableDescription
                          value={transaction.description}
                          transactionId={transaction.id}
                          onSave={handleDescriptionSave}
                        />
                      ) : (
                        <div className="max-w-md truncate" title={transaction.description}>
                          {transaction.description}
                        </div>
                      )}
                    </td>
                    {!hideAccountColumn && (
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {transaction.account?.name || '-'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {hasInlineEdit ? (
                        <EditableCategory
                          category={transaction.category}
                          transactionId={transaction.id}
                          categories={categories}
                          onSave={handleCategorySave}
                        />
                      ) : transaction.category ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {transaction.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Uncategorized</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                      transaction.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {formatAmount(transaction.amount)}
                    </td>
                    {showRunningBalance && (
                      <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${
                        transaction.running_balance === null
                          ? 'text-slate-400'
                          : (transaction.running_balance ?? 0) >= 0
                            ? 'text-slate-900'
                            : 'text-red-600'
                      }`}>
                        {transaction.running_balance === null
                          ? '-'
                          : formatAmount(transaction.running_balance ?? 0)}
                      </td>
                    )}
                    {/* Actions */}
                    {hasActions && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {onValidate && (
                            <button
                              onClick={() => onValidate(transaction)}
                              className={`p-1.5 rounded transition-colors ${
                                isValidated
                                  ? 'text-green-600 hover:text-green-700 hover:bg-green-100'
                                  : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                              }`}
                              title={isValidated ? 'Mark as unvalidated' : 'Mark as validated'}
                            >
                              <svg className="w-4 h-4" fill={isValidated ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(transaction)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit transaction"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(transaction)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete transaction"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
