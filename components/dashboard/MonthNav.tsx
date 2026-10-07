'use client';

import { MonthSwitcher } from '@/components/ui/MonthSwitcher';
import { currentMonth, monthKey, type YearMonth } from '@/lib/dashboard/overview';

interface MonthNavProps {
  month: YearMonth;
  onChange: (month: YearMonth) => void;
  now?: Date;
}

/** "‹ October 2026 ›": the month the Overview is showing. Months that haven't started can't be chosen. */
export function MonthNav({ month, onChange, now = new Date() }: MonthNavProps) {
  return (
    <MonthSwitcher
      className="-ml-2"
      value={monthKey(month)}
      max={monthKey(currentMonth(now))}
      onChange={(key) => {
        const [year, m] = key.split('-').map(Number);
        onChange({ year, month: m });
      }}
    />
  );
}
