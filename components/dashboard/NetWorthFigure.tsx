'use client';

import Link from 'next/link';
import { formatGBP } from '@/lib/format';
import { isCurrentMonth, monthKey, monthName, monthShort, shiftMonth, type YearMonth } from '@/lib/dashboard/overview';
import type { NetWorthHistory } from '@/lib/types/fire';
import type { Resource } from '@/lib/hooks/useDashboardData';

interface NetWorthFigureProps {
  month: YearMonth;
  current: Resource<{ netWorth: number }>;
  history: Resource<NetWorthHistory>;
  now?: Date;
}

function totalFor(history: NetWorthHistory | null, ym: YearMonth): number | null {
  const point = history?.snapshots.find((s) => s.date.startsWith(monthKey(ym)));
  return point ? point.total : null;
}

/**
 * The one headline figure. This month: today's net worth, with the change
 * since the start of the month. Past months: the month-end figure and the
 * change over that month. Changes come from the month-by-month history.
 */
export function NetWorthFigure({ month, current, history, now = new Date() }: NetWorthFigureProps) {
  const live = isCurrentMonth(month, now);
  const monthEnd = totalFor(history.data, month);
  const before = totalFor(history.data, shiftMonth(month, -1));
  const value = live ? current.data?.netWorth ?? null : monthEnd ?? current.data?.netWorth ?? null;
  const label = live || monthEnd === null ? 'Net worth' : `Net worth, end of ${monthName(month)}`;
  const change = monthEnd !== null && before !== null ? monthEnd - before : null;

  if (value === null && (current.isLoading || (!live && history.isLoading))) {
    return (
      <div className="grid gap-1.5 sm:justify-items-end" aria-busy="true" aria-label="Loading net worth">
        <div className="h-3 w-16 animate-pulse rounded bg-line-2" />
        <div className="h-8 w-40 animate-pulse rounded bg-line-2" />
      </div>
    );
  }
  if (value === null) {
    return (
      <div className="text-[13px] text-ink-3 sm:text-right">
        Net worth didn&apos;t load.{' '}
        <button type="button" onClick={current.retry} className="text-accent underline-offset-2 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <Link href="/wealth" className="group grid gap-1 rounded-md sm:justify-items-end">
      <span className="text-[12.5px] text-ink-3 group-hover:text-ink-2">{label}</span>
      <span className="fig text-[30px] font-medium leading-none tracking-tight text-ink">{formatGBP(value)}</span>
      {change !== null && Math.round(change) !== 0 && (
        <span className="text-[12.5px] text-ink-3">
          <span className={`fig ${change > 0 ? 'text-in' : 'text-ink-2'}`}>{formatGBP(change, { signed: true })}</span>{' '}
          {live ? `since 1 ${monthShort(month)}` : `in ${monthName(month)}`}
        </span>
      )}
    </Link>
  );
}
