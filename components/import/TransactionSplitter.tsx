'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ParsedTransaction } from '@/lib/types/import';

// =============================================================================
// TYPES
// =============================================================================

interface Category {
  id: string;
  name: string;
  group_name: string;
}

interface SplitRow {
  id: string;
  description: string;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
}

export interface TransactionSplitterProps {
  transaction: ParsedTransaction;
  categories: Category[];
  onSplit: (transactions: ParsedTransaction[]) => void;
  onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TransactionSplitter({
  transaction,
  categories,
  onSplit,
  onCancel,
}: TransactionSplitterProps) {
  const [splits, setSplits] = useState<SplitRow[]>([
    {
      id: crypto.randomUUID(),
      description: transaction.description,
      amount: transaction.amount,
      categoryId: null,
      categoryName: null,
    },
  ]);

  const [errors, setErrors] = useState<string[]>([]);

  // Calculate totals
  const splitsTotal = useMemo(() => {
    return splits.reduce((sum, split) => sum + split.amount, 0);
  }, [splits]);

  const difference = useMemo(() => {
    return Math.abs(transaction.amount - splitsTotal);
  }, [transaction.amount, splitsTotal]);

  const isBalanced = useMemo(() => {
    return difference < 0.01; // Allow for floating point errors
  }, [difference]);

  // Handlers
  const handleAddSplit = useCallback(() => {
    setSplits((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: '',
        amount: 0,
        categoryId: null,
        categoryName: null,
      },
    ]);
  }, []);

  const handleRemoveSplit = useCallback((id: string) => {
    setSplits((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const handleSplitChange = useCallback(
    (id: string, field: keyof SplitRow, value: string | number | null) => {
      setSplits((prev) =>
        prev.map((split) => {
          if (split.id !== id) return split;
          return { ...split, [field]: value };
        })
      );
    },
    []
  );

  const handleCategoryChange = useCallback(
    (id: string, categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      setSplits((prev) =>
        prev.map((split) => {
          if (split.id !== id) return split;
          return {
            ...split,
            categoryId,
            categoryName: category?.name || null,
          };
        })
      );
    },
    [categories]
  );

  const handleConfirm = useCallback(() => {
    // Validate
    const validationErrors: string[] = [];

    if (!isBalanced) {
      validationErrors.push(`Split amounts (${formatCurrency(splitsTotal)}) must equal original (${formatCurrency(transaction.amount)})`);
    }

    const emptySplits = splits.filter((s) => !s.description.trim());
    if (emptySplits.length > 0) {
      validationErrors.push('All splits must have a description');
    }

    const zeroAmounts = splits.filter((s) => s.amount === 0);
    if (zeroAmounts.length > 0) {
      validationErrors.push('All splits must have a non-zero amount');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Create transactions
    const newTransactions: ParsedTransaction[] = splits.map((split, index) => ({
      rowNumber: transaction.rowNumber + (index > 0 ? index * 0.001 : 0), // Keep ordering
      date: transaction.date,
      amount: split.amount,
      description: split.description,
      reference: transaction.reference ? `${transaction.reference}-${index + 1}` : undefined,
      balance: index === 0 ? transaction.balance : undefined, // Only first keeps balance
      rawData: {
        ...transaction.rawData,
        _splitFrom: String(transaction.rowNumber),
        _splitIndex: String(index),
      },
    }));

    onSplit(newTransactions);
  }, [splits, isBalanced, splitsTotal, transaction, onSplit]);

  const handleDistributeEvenly = useCallback(() => {
    const count = splits.length;
    if (count === 0) return;

    const evenAmount = Math.round((transaction.amount / count) * 100) / 100;
    const remainder = Math.round((transaction.amount - evenAmount * count) * 100) / 100;

    setSplits((prev) =>
      prev.map((split, index) => ({
        ...split,
        amount: index === 0 ? evenAmount + remainder : evenAmount,
      }))
    );
  }, [splits.length, transaction.amount]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Split Transaction</h2>
          <p className="text-sm text-slate-500 mt-1">
            Divide this transaction into multiple parts with different categories.
          </p>
        </div>

        {/* Original Transaction */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="text-xs text-slate-500 mb-1">Original Transaction</div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{transaction.description}</p>
              <p className="text-sm text-slate-500">
                {new Date(transaction.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <p className={`text-lg font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(transaction.amount)}
            </p>
          </div>
        </div>

        {/* Splits */}
        <div className="px-6 py-4 overflow-y-auto max-h-[40vh]">
          <div className="space-y-4">
            {splits.map((split, index) => (
              <div key={split.id} className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Split {index + 1}</span>
                  {splits.length > 1 && (
                    <button
                      onClick={() => handleRemoveSplit(split.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Description */}
                  <div className="md:col-span-1">
                    <label className="block text-xs text-slate-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={split.description}
                      onChange={(e) => handleSplitChange(split.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Description"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Amount</label>
                    <input
                      type="number"
                      value={split.amount}
                      onChange={(e) => handleSplitChange(split.id, 'amount', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Category</label>
                    <select
                      value={split.categoryId || ''}
                      onChange={(e) => handleCategoryChange(split.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select category --</option>
                      {Object.entries(
                        categories.reduce(
                          (acc, cat) => {
                            if (!acc[cat.group_name]) acc[cat.group_name] = [];
                            acc[cat.group_name].push(cat);
                            return acc;
                          },
                          {} as Record<string, Category[]>
                        )
                      ).map(([group, cats]) => (
                        <optgroup key={group} label={group}>
                          {cats.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Split Button */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAddSplit}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add another split
            </button>
            {splits.length >= 2 && (
              <button
                onClick={handleDistributeEvenly}
                className="text-sm text-slate-600 hover:text-slate-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Distribute evenly
              </button>
            )}
          </div>
        </div>

        {/* Balance Check */}
        <div className={`px-6 py-3 border-t border-slate-200 ${isBalanced ? 'bg-green-50' : 'bg-amber-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-slate-500">Original</span>
                <p className="font-medium">{formatCurrency(transaction.amount)}</p>
              </div>
              <div className="text-slate-400">=</div>
              <div>
                <span className="text-xs text-slate-500">Splits Total</span>
                <p className="font-medium">{formatCurrency(splitsTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <>
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-700 font-medium">Balanced</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-amber-700 font-medium">
                    Difference: {formatCurrency(difference)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-100">
            <ul className="text-sm text-red-700 list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isBalanced}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            Split Transaction
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
}
