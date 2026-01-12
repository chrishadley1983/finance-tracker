'use client';

import { getMonthName } from '@/lib/types/budget';

interface MonthSelectorProps {
  year: number;
  month: number | null;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number | null) => void;
  viewMode: 'month' | 'year';
}

export function MonthSelector({
  year,
  month,
  onYearChange,
  onMonthChange,
  viewMode,
}: MonthSelectorProps) {
  const handlePrevious = () => {
    if (viewMode === 'year') {
      onYearChange(year - 1);
    } else if (month !== null) {
      if (month === 1) {
        onYearChange(year - 1);
        onMonthChange(12);
      } else {
        onMonthChange(month - 1);
      }
    }
  };

  const handleNext = () => {
    if (viewMode === 'year') {
      onYearChange(year + 1);
    } else if (month !== null) {
      if (month === 12) {
        onYearChange(year + 1);
        onMonthChange(1);
      } else {
        onMonthChange(month + 1);
      }
    }
  };

  const displayText = viewMode === 'year'
    ? String(year)
    : month !== null
      ? `${getMonthName(month)} ${year}`
      : String(year);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePrevious}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Previous"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-lg font-semibold min-w-[180px] text-center">
        {displayText}
      </span>
      <button
        onClick={handleNext}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Next"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
