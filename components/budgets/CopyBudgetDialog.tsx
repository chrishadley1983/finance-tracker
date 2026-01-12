'use client';

import { useState } from 'react';

interface CopyBudgetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetYear: number;
}

export function CopyBudgetDialog({
  isOpen,
  onClose,
  onSuccess,
  targetYear,
}: CopyBudgetDialogProps) {
  const currentYear = new Date().getFullYear();
  const [sourceYear, setSourceYear] = useState(targetYear - 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/budgets/copy-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceYear, targetYear }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to copy budgets');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy budgets');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Generate year options (5 years back from target)
  const yearOptions = [];
  for (let y = targetYear - 1; y >= targetYear - 5 && y >= 2020; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Copy Budget
              </h2>
              <p className="text-sm text-slate-500">
                Create {targetYear} budget from a previous year
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
          <div className="p-4 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Copy budgets from
              </label>
              <select
                value={sourceYear}
                onChange={(e) => setSourceYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md
                         bg-white text-slate-900
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <svg
                className="w-5 h-5 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                This will copy all monthly budgets from {sourceYear} to {targetYear}.
              </span>
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
              {isSubmitting ? 'Copying...' : 'Copy Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
