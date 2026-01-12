'use client';

import { useState, useEffect } from 'react';
import { formatBudgetCurrency, MONTH_NAMES } from '@/lib/types/budget';

interface MonthlyBudget {
  month: number;
  amount: number;
}

interface BudgetBulkEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budgets: MonthlyBudget[]) => Promise<void>;
  categoryId: string;
  categoryName: string;
  groupName: string;
  year: number;
  currentBudgets: MonthlyBudget[];
}

export function BudgetBulkEditDialog({
  isOpen,
  onClose,
  onSave,
  categoryName,
  groupName,
  year,
  currentBudgets,
}: BudgetBulkEditDialogProps) {
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [annualAmount, setAnnualAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize with all 12 months
    const initialBudgets: MonthlyBudget[] = [];
    for (let month = 1; month <= 12; month++) {
      const existing = currentBudgets.find((b) => b.month === month);
      initialBudgets.push({
        month,
        amount: existing?.amount || 0,
      });
    }
    setBudgets(initialBudgets);
    setAnnualAmount(initialBudgets.reduce((sum, b) => sum + b.amount, 0));
    setError(null);
  }, [currentBudgets, isOpen]);

  const handleMonthChange = (month: number, amount: number) => {
    setBudgets((prev) => {
      const updated = prev.map((b) =>
        b.month === month ? { ...b, amount } : b
      );
      setAnnualAmount(updated.reduce((sum, b) => sum + b.amount, 0));
      return updated;
    });
  };

  const handleDistributeEvenly = () => {
    const monthlyAmount = Math.round((annualAmount / 12) * 100) / 100;
    setBudgets((prev) =>
      prev.map((b) => ({ ...b, amount: monthlyAmount }))
    );
  };

  const handleSetAnnual = (newAnnual: number) => {
    setAnnualAmount(newAnnual);
    const monthlyAmount = Math.round((newAnnual / 12) * 100) / 100;
    setBudgets((prev) =>
      prev.map((b) => ({ ...b, amount: monthlyAmount }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(budgets);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budgets');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Annual Budget
              </h2>
              <p className="text-sm text-slate-500">
                {year} - {categoryName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            {/* Category info */}
            <div className="text-sm">
              <span className="text-slate-500">Category:</span>{' '}
              <span className="font-medium text-slate-900">{categoryName}</span>
              <br />
              <span className="text-slate-500">Group:</span>{' '}
              <span className="text-slate-700">{groupName}</span>
            </div>

            {/* Annual total with distribute button */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Annual Total
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      £
                    </span>
                    <input
                      type="number"
                      value={annualAmount}
                      onChange={(e) => handleSetAnnual(parseFloat(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-md
                               bg-white text-slate-900
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDistributeEvenly}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md
                           hover:bg-blue-100 transition-colors whitespace-nowrap"
                >
                  Distribute Evenly
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Monthly: {formatBudgetCurrency(annualAmount / 12)}
              </p>
            </div>

            {/* Monthly inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {budgets.map((budget) => (
                <div key={budget.month}>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    {MONTH_NAMES[budget.month - 1].substring(0, 3)}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      £
                    </span>
                    <input
                      type="number"
                      value={budget.amount}
                      onChange={(e) =>
                        handleMonthChange(
                          budget.month,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-300 rounded-md
                               bg-white text-slate-900
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700
                       border border-slate-300 rounded-md
                       hover:bg-slate-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save All Months'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
