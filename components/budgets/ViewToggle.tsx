'use client';

import type { BudgetViewMode } from '@/lib/types/budget';

interface ViewToggleProps {
  viewMode: BudgetViewMode;
  onViewModeChange: (mode: BudgetViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('month')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'month'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Month
      </button>
      <button
        onClick={() => onViewModeChange('year')}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'year'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        Year
      </button>
    </div>
  );
}
