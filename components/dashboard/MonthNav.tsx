'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { compareMonths, currentMonth, monthKey, monthName, shiftMonth, type YearMonth } from '@/lib/dashboard/overview';

interface MonthNavProps {
  month: YearMonth;
  onChange: (month: YearMonth) => void;
  now?: Date;
}

const step =
  'inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13.5px] text-ink-3 hover:bg-line-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

/** "‹ September  October  November ›": the month the Overview is showing. */
export function MonthNav({ month, onChange, now = new Date() }: MonthNavProps) {
  const today = currentMonth(now);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const nextAllowed = compareMonths(next, today) <= 0;
  const withYear = (m: YearMonth) => (m.year === today.year ? monthName(m) : `${monthName(m)} ${m.year}`);

  return (
    <nav aria-label="Month" className="-ml-2 flex items-center gap-0.5">
      <button type="button" className={step} onClick={() => onChange(prev)} aria-label={`Previous month, ${withYear(prev)}`}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{monthName(prev)}</span>
      </button>
      <h2 className="px-1.5 text-lg font-semibold tracking-tight text-ink">
        <time dateTime={monthKey(month)}>{withYear(month)}</time>
      </h2>
      <button
        type="button"
        className={step}
        onClick={() => onChange(next)}
        disabled={!nextAllowed}
        aria-label={nextAllowed ? `Next month, ${withYear(next)}` : `Next month, ${withYear(next)} (not started yet)`}
      >
        <span className="hidden sm:inline">{monthName(next)}</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
