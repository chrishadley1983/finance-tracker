'use client';

import { useState } from 'react';

export type TimeframePeriod =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'all_time'
  | 'custom';

interface TimeframeSelectorProps {
  value: TimeframePeriod;
  onChange: (period: TimeframePeriod, customStart?: string, customEnd?: string) => void;
  customStart?: string;
  customEnd?: string;
}

const PERIOD_LABELS: Record<TimeframePeriod, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  last_quarter: 'Last Quarter',
  this_year: 'This Year',
  last_year: 'Last Year',
  all_time: 'All Time',
  custom: 'Custom',
};

export function TimeframeSelector({
  value,
  onChange,
  customStart,
  customEnd
}: TimeframeSelectorProps) {
  const [showCustom, setShowCustom] = useState(value === 'custom');
  const [startDate, setStartDate] = useState(customStart || '');
  const [endDate, setEndDate] = useState(customEnd || '');

  const handlePeriodChange = (period: TimeframePeriod) => {
    if (period === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(period);
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      onChange('custom', startDate, endDate);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => handlePeriodChange(e.target.value as TimeframePeriod)}
        className="h-9 px-3 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {Object.entries(PERIOD_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 px-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 px-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleCustomApply}
            disabled={!startDate || !endDate}
            className="h-9 px-3 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
