'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { formatDateGB } from '@/lib/format';
import { formatAmount } from '@/components/transactions/TransactionTable';

// =============================================================================
// TYPES
// =============================================================================

export type CellType = 'text' | 'number' | 'date' | 'category';

export interface EditableCellProps {
  value: string | number | null;
  type: CellType;
  isEditing: boolean;
  isModified: boolean;
  isSkipped?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onChange: (value: string | number) => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  // For category type
  categories?: Array<{ id: string; name: string; group_name: string }>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EditableCell({
  value,
  type,
  isEditing,
  isModified,
  isSkipped = false,
  hasError = false,
  errorMessage,
  onChange,
  onStartEdit,
  onEndEdit,
  onKeyDown,
  disabled = false,
  placeholder = '',
  categories = [],
}: EditableCellProps) {
  const [localValue, setLocalValue] = useState<string>(formatValue(value, type));
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update local value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(formatValue(value, type));
    }
  }, [value, type, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isEditing || type !== 'category') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onEndEdit();
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, type, onEndEdit]);

  const handleConfirm = useCallback(() => {
    const parsed = parseValue(localValue, type);
    if (parsed !== null) {
      onChange(parsed);
    }
    onEndEdit();
  }, [localValue, type, onChange, onEndEdit]);

  const handleCancel = useCallback(() => {
    setLocalValue(formatValue(value, type));
    onEndEdit();
  }, [value, type, onEndEdit]);

  const handleKeyDownInternal = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Tab') {
      // Allow tab to propagate for cell navigation
      handleConfirm();
    }
    onKeyDown?.(e);
  }, [handleConfirm, handleCancel, onKeyDown]);

  const handleCategorySelect = useCallback((categoryId: string) => {
    onChange(categoryId);
    onEndEdit();
    setSearchTerm('');
  }, [onChange, onEndEdit]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  // Get cell classes based on state
  const getCellClasses = () => {
    const base = 'px-2 py-1.5 min-h-[32px] cursor-pointer transition-colors';
    const states: string[] = [base];

    if (isSkipped) {
      states.push('line-through text-ink-3 bg-sunk');
    } else if (hasError) {
      states.push('bg-bad-soft border border-bad/40');
    } else if (isModified) {
      states.push('bg-warn-soft');
    } else {
      states.push('hover:bg-sunk');
    }

    if (disabled) {
      states.push('cursor-not-allowed opacity-60');
    }

    return states.join(' ');
  };

  // Format display value
  const getDisplayValue = () => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-ink-3 italic">{placeholder || '—'}</span>;
    }

    if (type === 'date') {
      const d = new Date(value as string);
      return Number.isNaN(d.getTime()) ? String(value) : <span className="whitespace-nowrap">{formatDateGB(d)}</span>;
    }

    if (type === 'number') {
      const num = typeof value === 'number' ? value : parseFloat(value as string);
      if (!isNaN(num)) {
        // Same convention as the Transactions table: spending in ink, money in with a leading +.
        return <span className={`fig whitespace-nowrap ${num > 0 ? 'text-in' : 'text-ink'}`}>{formatAmount(num)}</span>;
      }
    }

    if (type === 'category') {
      const cat = categories.find((c) => c.id === value);
      return cat ? cat.name : <span className="text-ink-3 italic">Uncategorised</span>;
    }

    return String(value);
  };

  // Filter categories by search
  const filteredCategories = searchTerm
    ? categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cat.group_name.toLowerCase().includes(searchTerm.toLowerCase())
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
    {} as Record<string, typeof categories>
  );

  // =============================================================================
  // RENDER
  // =============================================================================

  if (disabled) {
    return (
      <div className={getCellClasses()}>
        {getDisplayValue()}
      </div>
    );
  }

  // Display mode
  if (!isEditing) {
    return (
      <div
        className={getCellClasses()}
        onClick={onStartEdit}
        title={hasError ? errorMessage : isModified ? 'Modified' : undefined}
      >
        <div className="flex items-center gap-1">
          {getDisplayValue()}
          {isModified && !isSkipped && (
            <span className="inline-block w-1.5 h-1.5 bg-warn rounded-full" title="Modified" />
          )}
        </div>
      </div>
    );
  }

  // Category dropdown
  if (type === 'category') {
    return (
      <div className="relative" ref={dropdownRef}>
        <div className={`${getCellClasses()} ring-2 ring-accent`}>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDownInternal}
            placeholder="Search categories..."
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>
        <div className="absolute left-0 top-full mt-1 w-56 bg-surface rounded-md shadow-lg border border-line z-30 max-h-60 overflow-y-auto">
          {Object.entries(groupedCategories).length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-3">No categories found</div>
          ) : (
            Object.entries(groupedCategories).map(([group, cats]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs text-ink-3 bg-sunk sticky top-0">
                  {group}
                </div>
                {cats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-sunk ${
                      cat.id === value ? 'bg-accent-soft text-accent' : ''
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
    );
  }

  // Text/Number/Date input
  return (
    <div className={`${getCellClasses()} ring-2 ring-accent`}>
      <input
        ref={inputRef}
        type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleConfirm}
        onKeyDown={handleKeyDownInternal}
        step={type === 'number' ? '0.01' : undefined}
        className="w-full bg-transparent outline-none text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatValue(value: string | number | null | undefined, type: CellType): string {
  if (value === null || value === undefined) return '';

  if (type === 'date') {
    try {
      const date = new Date(value as string);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Fall through
    }
    return String(value);
  }

  if (type === 'number') {
    return String(value);
  }

  return String(value);
}

function parseValue(value: string, type: CellType): string | number | null {
  if (!value.trim()) return null;

  if (type === 'number') {
    const num = parseFloat(value.replace(/[£,]/g, ''));
    return isNaN(num) ? null : num;
  }

  if (type === 'date') {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  }

  return value;
}
