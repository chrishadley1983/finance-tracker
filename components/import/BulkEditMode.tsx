'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EditableCell } from './EditableCell';
import { BulkEditToolbar } from './BulkEditToolbar';
import { TransactionSplitter } from './TransactionSplitter';
import type { ParsedTransaction } from '@/lib/types/import';
import type { CategorisationResult } from '@/lib/categorisation';

// =============================================================================
// TYPES
// =============================================================================

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface Modification {
  field: 'date' | 'description' | 'amount' | 'category';
  originalValue: string | number | null;
  newValue: string | number | null;
}

interface UndoAction {
  type: 'edit' | 'bulk_edit' | 'skip' | 'unskip' | 'delete' | 'split' | 'reset';
  rowIndices: number[];
  previousState: Map<number, ParsedTransaction>;
  previousSkipped: Set<number>;
  previousCategoryOverrides: Map<number, { categoryId: string; categoryName: string }>;
}

export interface BulkEditModeProps {
  transactions: ParsedTransaction[];
  categorisationResults: Map<number, CategorisationResult>;
  categoryOverrides: Map<number, { categoryId: string; categoryName: string }>;
  categories: Category[];
  onTransactionsChange: (transactions: ParsedTransaction[]) => void;
  onCategoryOverridesChange: (overrides: Map<number, { categoryId: string; categoryName: string }>) => void;
  onExit: () => void;
}

type EditingCell = { row: number; field: 'date' | 'description' | 'amount' | 'category' } | null;

// =============================================================================
// COMPONENT
// =============================================================================

export function BulkEditMode({
  transactions: initialTransactions,
  categorisationResults,
  categoryOverrides: initialCategoryOverrides,
  categories,
  onTransactionsChange,
  onCategoryOverridesChange,
  onExit,
}: BulkEditModeProps) {
  // State
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([...initialTransactions]);
  const [categoryOverrides, setCategoryOverrides] = useState<Map<number, { categoryId: string; categoryName: string }>>(
    new Map(initialCategoryOverrides)
  );
  const [modifications, setModifications] = useState<Map<number, Set<string>>>(new Map());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  const [splittingTransaction, setSplittingTransaction] = useState<{ index: number; transaction: ParsedTransaction } | null>(null);
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48, // Row height
    overscan: 10,
  });

  // =============================================================================
  // KEYBOARD SHORTCUTS
  // =============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if editing
      if (editingCell) return;

      // Ctrl+A - Select all
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedRows(new Set(transactions.map((_, i) => i)));
      }

      // Ctrl+Z - Undo
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl+Shift+Z - Redo
      if (e.ctrlKey && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
      }

      // Delete - Skip selected
      if (e.key === 'Delete' && selectedRows.size > 0) {
        e.preventDefault();
        handleBulkSkip();
      }

      // Ctrl+D - Duplicate selected row
      if (e.ctrlKey && e.key === 'd' && selectedRows.size === 1) {
        e.preventDefault();
        const rowIndex = Array.from(selectedRows)[0];
        handleDuplicateRow(rowIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell, selectedRows, transactions]);

  // =============================================================================
  // UNDO/REDO HELPERS
  // =============================================================================

  const saveUndoState = useCallback((type: UndoAction['type'], rowIndices: number[]) => {
    const previousState = new Map<number, ParsedTransaction>();
    rowIndices.forEach((i) => {
      if (transactions[i]) {
        previousState.set(i, { ...transactions[i] });
      }
    });

    setUndoStack((prev) => [
      ...prev.slice(-19), // Keep last 20
      {
        type,
        rowIndices,
        previousState,
        previousSkipped: new Set(skippedRows),
        previousCategoryOverrides: new Map(categoryOverrides),
      },
    ]);
    setRedoStack([]); // Clear redo on new action
  }, [transactions, skippedRows, categoryOverrides]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];

    // Save current state for redo
    const currentState = new Map<number, ParsedTransaction>();
    action.rowIndices.forEach((i) => {
      if (transactions[i]) {
        currentState.set(i, { ...transactions[i] });
      }
    });

    setRedoStack((prev) => [
      ...prev,
      {
        ...action,
        previousState: currentState,
        previousSkipped: new Set(skippedRows),
        previousCategoryOverrides: new Map(categoryOverrides),
      },
    ]);

    // Restore previous state
    setTransactions((prev) => {
      const next = [...prev];
      action.previousState.forEach((tx, i) => {
        next[i] = tx;
      });
      return next;
    });
    setSkippedRows(action.previousSkipped);
    setCategoryOverrides(action.previousCategoryOverrides);

    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, transactions, skippedRows, categoryOverrides]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];

    // Save current state for undo
    const currentState = new Map<number, ParsedTransaction>();
    action.rowIndices.forEach((i) => {
      if (transactions[i]) {
        currentState.set(i, { ...transactions[i] });
      }
    });

    setUndoStack((prev) => [
      ...prev,
      {
        ...action,
        previousState: currentState,
        previousSkipped: new Set(skippedRows),
        previousCategoryOverrides: new Map(categoryOverrides),
      },
    ]);

    // Restore redo state
    setTransactions((prev) => {
      const next = [...prev];
      action.previousState.forEach((tx, i) => {
        next[i] = tx;
      });
      return next;
    });
    setSkippedRows(action.previousSkipped);
    setCategoryOverrides(action.previousCategoryOverrides);

    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, transactions, skippedRows, categoryOverrides]);

  // =============================================================================
  // CELL EDITING
  // =============================================================================

  const handleCellChange = useCallback((rowIndex: number, field: 'date' | 'description' | 'amount', value: string | number) => {
    saveUndoState('edit', [rowIndex]);

    setTransactions((prev) => {
      const next = [...prev];
      const tx = { ...next[rowIndex] };

      if (field === 'date') {
        tx.date = value as string;
      } else if (field === 'description') {
        tx.description = value as string;
      } else if (field === 'amount') {
        tx.amount = value as number;
      }

      next[rowIndex] = tx;
      return next;
    });

    // Mark as modified
    setModifications((prev) => {
      const next = new Map(prev);
      const fields = next.get(rowIndex) || new Set();
      fields.add(field);
      next.set(rowIndex, fields);
      return next;
    });
  }, [saveUndoState]);

  const handleCategoryChange = useCallback((rowIndex: number, categoryId: string, categoryName: string) => {
    saveUndoState('edit', [rowIndex]);

    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      next.set(rowIndex, { categoryId, categoryName });
      return next;
    });

    setModifications((prev) => {
      const next = new Map(prev);
      const fields = next.get(rowIndex) || new Set();
      fields.add('category');
      next.set(rowIndex, fields);
      return next;
    });
  }, [saveUndoState]);

  // =============================================================================
  // ROW SELECTION
  // =============================================================================

  const handleRowClick = useCallback((rowIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow !== null) {
      // Range select
      const start = Math.min(lastClickedRow, rowIndex);
      const end = Math.max(lastClickedRow, rowIndex);
      const range = new Set<number>();
      for (let i = start; i <= end; i++) {
        range.add(i);
      }
      setSelectedRows((prev) => {
        if (e.ctrlKey) {
          // Add to existing selection
          return new Set([...Array.from(prev), ...Array.from(range)]);
        }
        return range;
      });
    } else if (e.ctrlKey) {
      // Toggle single
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowIndex)) {
          next.delete(rowIndex);
        } else {
          next.add(rowIndex);
        }
        return next;
      });
    } else {
      // Single select
      setSelectedRows(new Set([rowIndex]));
    }
    setLastClickedRow(rowIndex);
  }, [lastClickedRow]);

  const handleCheckboxChange = useCallback((rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, []);

  // =============================================================================
  // BULK ACTIONS
  // =============================================================================

  const handleSelectAll = useCallback(() => {
    setSelectedRows(new Set(transactions.map((_, i) => i)));
  }, [transactions]);

  const handleSelectNone = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const handleBulkSetDate = useCallback((date: string) => {
    const indices = Array.from(selectedRows);
    saveUndoState('bulk_edit', indices);

    setTransactions((prev) => {
      const next = [...prev];
      indices.forEach((i) => {
        next[i] = { ...next[i], date };
      });
      return next;
    });

    setModifications((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => {
        const fields = next.get(i) || new Set();
        fields.add('date');
        next.set(i, fields);
      });
      return next;
    });
  }, [selectedRows, saveUndoState]);

  const handleBulkSetCategory = useCallback((categoryId: string, categoryName: string) => {
    const indices = Array.from(selectedRows);
    saveUndoState('bulk_edit', indices);

    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => {
        next.set(i, { categoryId, categoryName });
      });
      return next;
    });

    setModifications((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => {
        const fields = next.get(i) || new Set();
        fields.add('category');
        next.set(i, fields);
      });
      return next;
    });
  }, [selectedRows, saveUndoState]);

  const handleBulkAdjustAmount = useCallback((adjustment: { type: 'add' | 'subtract' | 'multiply'; value: number }) => {
    const indices = Array.from(selectedRows);
    saveUndoState('bulk_edit', indices);

    setTransactions((prev) => {
      const next = [...prev];
      indices.forEach((i) => {
        const tx = { ...next[i] };
        if (adjustment.type === 'add') {
          tx.amount = tx.amount + adjustment.value;
        } else if (adjustment.type === 'subtract') {
          tx.amount = tx.amount - adjustment.value;
        } else if (adjustment.type === 'multiply') {
          tx.amount = tx.amount * (1 + adjustment.value / 100);
        }
        tx.amount = Math.round(tx.amount * 100) / 100; // Round to 2 decimals
        next[i] = tx;
      });
      return next;
    });

    setModifications((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => {
        const fields = next.get(i) || new Set();
        fields.add('amount');
        next.set(i, fields);
      });
      return next;
    });
  }, [selectedRows, saveUndoState]);

  const handleBulkSkip = useCallback(() => {
    const indices = Array.from(selectedRows);
    saveUndoState('skip', indices);

    setSkippedRows((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => next.add(i));
      return next;
    });
    setSelectedRows(new Set());
  }, [selectedRows, saveUndoState]);

  const handleBulkDelete = useCallback(() => {
    const indices = Array.from(selectedRows).sort((a, b) => b - a); // Sort descending
    saveUndoState('delete', indices);

    setTransactions((prev) => {
      const next = [...prev];
      indices.forEach((i) => {
        next.splice(i, 1);
      });
      return next;
    });

    // Adjust indices in modifications, skipped, and category overrides
    setModifications((prev) => {
      const next = new Map<number, Set<string>>();
      prev.forEach((fields, i) => {
        const offset = indices.filter((idx) => idx < i).length;
        if (!indices.includes(i)) {
          next.set(i - offset, fields);
        }
      });
      return next;
    });

    setSkippedRows((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        const offset = indices.filter((idx) => idx < i).length;
        if (!indices.includes(i)) {
          next.add(i - offset);
        }
      });
      return next;
    });

    setCategoryOverrides((prev) => {
      const next = new Map<number, { categoryId: string; categoryName: string }>();
      prev.forEach((override, i) => {
        const offset = indices.filter((idx) => idx < i).length;
        if (!indices.includes(i)) {
          next.set(i - offset, override);
        }
      });
      return next;
    });

    setSelectedRows(new Set());
  }, [selectedRows, saveUndoState]);

  const handleBulkReset = useCallback(() => {
    const indices = Array.from(selectedRows);
    saveUndoState('reset', indices);

    // Reset to initial values
    setTransactions((prev) => {
      const next = [...prev];
      indices.forEach((i) => {
        if (initialTransactions[i]) {
          next[i] = { ...initialTransactions[i] };
        }
      });
      return next;
    });

    // Clear modifications for these rows
    setModifications((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => next.delete(i));
      return next;
    });

    // Clear category overrides for these rows
    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      indices.forEach((i) => next.delete(i));
      return next;
    });

    // Unskip these rows
    setSkippedRows((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => next.delete(i));
      return next;
    });
  }, [selectedRows, initialTransactions, saveUndoState]);

  const handleResetAll = useCallback(() => {
    saveUndoState('reset', transactions.map((_, i) => i));

    setTransactions([...initialTransactions]);
    setModifications(new Map());
    setCategoryOverrides(new Map(initialCategoryOverrides));
    setSkippedRows(new Set());
  }, [transactions, initialTransactions, initialCategoryOverrides, saveUndoState]);

  // =============================================================================
  // ROW ACTIONS
  // =============================================================================

  const handleToggleSkip = useCallback((rowIndex: number) => {
    saveUndoState('skip', [rowIndex]);

    setSkippedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  }, [saveUndoState]);

  const handleDuplicateRow = useCallback((rowIndex: number) => {
    saveUndoState('edit', [rowIndex]);

    const tx = { ...transactions[rowIndex] };
    tx.rowNumber = tx.rowNumber + 0.001; // Keep ordering

    setTransactions((prev) => {
      const next = [...prev];
      next.splice(rowIndex + 1, 0, tx);
      return next;
    });
  }, [transactions, saveUndoState]);

  const handleSplitTransaction = useCallback((rowIndex: number) => {
    setSplittingTransaction({ index: rowIndex, transaction: transactions[rowIndex] });
  }, [transactions]);

  const handleSplitConfirm = useCallback((newTransactions: ParsedTransaction[]) => {
    if (!splittingTransaction) return;

    const { index } = splittingTransaction;
    saveUndoState('split', [index]);

    setTransactions((prev) => {
      const next = [...prev];
      next.splice(index, 1, ...newTransactions);
      return next;
    });

    setSplittingTransaction(null);
  }, [splittingTransaction, saveUndoState]);

  // =============================================================================
  // SAVE & EXIT
  // =============================================================================

  const handleSave = useCallback(() => {
    // Filter out skipped rows
    const finalTransactions = transactions.filter((_, i) => !skippedRows.has(i));

    // Adjust category overrides for removed rows
    const adjustedOverrides = new Map<number, { categoryId: string; categoryName: string }>();
    let offset = 0;
    transactions.forEach((_, i) => {
      if (skippedRows.has(i)) {
        offset++;
      } else if (categoryOverrides.has(i)) {
        adjustedOverrides.set(i - offset, categoryOverrides.get(i)!);
      }
    });

    onTransactionsChange(finalTransactions);
    onCategoryOverridesChange(adjustedOverrides);
    onExit();
  }, [transactions, skippedRows, categoryOverrides, onTransactionsChange, onCategoryOverridesChange, onExit]);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const modifiedCount = useMemo(() => modifications.size, [modifications]);
  const skippedCount = useMemo(() => skippedRows.size, [skippedRows]);

  // =============================================================================
  // RENDER
  // =============================================================================

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
        <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-amber-800 font-medium">Edit Mode Active</p>
          <p className="text-xs text-amber-600">Changes will be applied when you import. Click cells to edit.</p>
        </div>
        <button
          onClick={onExit}
          className="px-3 py-1.5 text-sm text-amber-700 border border-amber-300 rounded hover:bg-amber-100"
        >
          Exit Edit Mode
        </button>
      </div>

      {/* Toolbar */}
      <BulkEditToolbar
        selectedCount={selectedRows.size}
        totalCount={transactions.length}
        modifiedCount={modifiedCount}
        skippedCount={skippedCount}
        categories={categories}
        onSelectAll={handleSelectAll}
        onSelectNone={handleSelectNone}
        onBulkSetDate={handleBulkSetDate}
        onBulkSetCategory={handleBulkSetCategory}
        onBulkAdjustAmount={handleBulkAdjustAmount}
        onBulkSkip={handleBulkSkip}
        onBulkDelete={handleBulkDelete}
        onBulkReset={handleBulkReset}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onResetAll={handleResetAll}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      {/* Keyboard Shortcuts Help */}
      <div className="text-xs text-slate-500 flex flex-wrap gap-4">
        <span><kbd className="px-1 py-0.5 bg-slate-100 rounded">Ctrl+A</kbd> Select all</span>
        <span><kbd className="px-1 py-0.5 bg-slate-100 rounded">Shift+Click</kbd> Range select</span>
        <span><kbd className="px-1 py-0.5 bg-slate-100 rounded">Ctrl+Z</kbd> Undo</span>
        <span><kbd className="px-1 py-0.5 bg-slate-100 rounded">Delete</kbd> Skip selected</span>
        <span><kbd className="px-1 py-0.5 bg-slate-100 rounded">Tab</kbd> Next cell</span>
      </div>

      {/* Virtual Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200">
          <div className="flex items-center text-sm font-medium text-slate-600">
            <div className="w-12 px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={selectedRows.size === transactions.length && transactions.length > 0}
                onChange={(e) => e.target.checked ? handleSelectAll() : handleSelectNone()}
                className="rounded border-slate-300"
              />
            </div>
            <div className="w-12 px-2 py-2 text-center">#</div>
            <div className="w-28 px-2 py-2">Date</div>
            <div className="flex-1 px-2 py-2 min-w-[200px]">Description</div>
            <div className="w-28 px-2 py-2 text-right">Amount</div>
            <div className="w-40 px-2 py-2">Category</div>
            <div className="w-24 px-2 py-2 text-center">Actions</div>
          </div>
        </div>

        {/* Virtual Rows */}
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ height: Math.min(transactions.length * 48, 500) }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualRows.map((virtualRow) => {
              const rowIndex = virtualRow.index;
              const tx = transactions[rowIndex];
              const isSelected = selectedRows.has(rowIndex);
              const isSkipped = skippedRows.has(rowIndex);
              const rowMods = modifications.get(rowIndex);
              const categoryOverride = categoryOverrides.get(rowIndex);
              const catResult = categorisationResults.get(rowIndex);

              return (
                <div
                  key={rowIndex}
                  data-index={rowIndex}
                  ref={rowVirtualizer.measureElement}
                  className={`flex items-center border-b border-slate-100 ${
                    isSelected ? 'bg-blue-50' : isSkipped ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={(e) => {
                    // Only trigger row selection if clicking on empty space
                    if ((e.target as HTMLElement).tagName === 'DIV') {
                      handleRowClick(rowIndex, e);
                    }
                  }}
                >
                  {/* Checkbox */}
                  <div className="w-12 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleCheckboxChange(rowIndex)}
                      className="rounded border-slate-300"
                    />
                  </div>

                  {/* Row Number */}
                  <div className="w-12 px-2 py-2 text-center text-xs text-slate-400">
                    {tx.rowNumber}
                  </div>

                  {/* Date */}
                  <div className="w-28">
                    <EditableCell
                      value={tx.date}
                      type="date"
                      isEditing={editingCell?.row === rowIndex && editingCell?.field === 'date'}
                      isModified={rowMods?.has('date') || false}
                      isSkipped={isSkipped}
                      onChange={(value) => handleCellChange(rowIndex, 'date', value)}
                      onStartEdit={() => setEditingCell({ row: rowIndex, field: 'date' })}
                      onEndEdit={() => setEditingCell(null)}
                      disabled={isSkipped}
                    />
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-[200px]">
                    <EditableCell
                      value={tx.description}
                      type="text"
                      isEditing={editingCell?.row === rowIndex && editingCell?.field === 'description'}
                      isModified={rowMods?.has('description') || false}
                      isSkipped={isSkipped}
                      onChange={(value) => handleCellChange(rowIndex, 'description', value)}
                      onStartEdit={() => setEditingCell({ row: rowIndex, field: 'description' })}
                      onEndEdit={() => setEditingCell(null)}
                      disabled={isSkipped}
                    />
                  </div>

                  {/* Amount */}
                  <div className="w-28">
                    <EditableCell
                      value={tx.amount}
                      type="number"
                      isEditing={editingCell?.row === rowIndex && editingCell?.field === 'amount'}
                      isModified={rowMods?.has('amount') || false}
                      isSkipped={isSkipped}
                      onChange={(value) => handleCellChange(rowIndex, 'amount', value)}
                      onStartEdit={() => setEditingCell({ row: rowIndex, field: 'amount' })}
                      onEndEdit={() => setEditingCell(null)}
                      disabled={isSkipped}
                    />
                  </div>

                  {/* Category */}
                  <div className="w-40">
                    <EditableCell
                      value={categoryOverride?.categoryId || catResult?.categoryId || null}
                      type="category"
                      isEditing={editingCell?.row === rowIndex && editingCell?.field === 'category'}
                      isModified={rowMods?.has('category') || false}
                      isSkipped={isSkipped}
                      onChange={(value) => {
                        const cat = categories.find((c) => c.id === value);
                        if (cat) {
                          handleCategoryChange(rowIndex, cat.id, cat.name);
                        }
                      }}
                      onStartEdit={() => setEditingCell({ row: rowIndex, field: 'category' })}
                      onEndEdit={() => setEditingCell(null)}
                      disabled={isSkipped}
                      categories={categories}
                      placeholder="Uncategorised"
                    />
                  </div>

                  {/* Actions */}
                  <div className="w-24 px-2 py-2 flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleToggleSkip(rowIndex)}
                      className={`p-1 rounded ${isSkipped ? 'text-green-600 hover:bg-green-100' : 'text-slate-400 hover:bg-slate-100'}`}
                      title={isSkipped ? 'Include in import' : 'Skip this row'}
                    >
                      {isSkipped ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleSplitTransaction(rowIndex)}
                      disabled={isSkipped}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded disabled:opacity-50"
                      title="Split transaction"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDuplicateRow(rowIndex)}
                      disabled={isSkipped}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded disabled:opacity-50"
                      title="Duplicate row"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onExit}
          className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Apply Changes ({transactions.length - skippedCount} rows)
        </button>
      </div>

      {/* Transaction Splitter Modal */}
      {splittingTransaction && (
        <TransactionSplitter
          transaction={splittingTransaction.transaction}
          categories={categories}
          onSplit={handleSplitConfirm}
          onCancel={() => setSplittingTransaction(null)}
        />
      )}
    </div>
  );
}
