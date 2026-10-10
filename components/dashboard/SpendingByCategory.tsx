'use client';

import { useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/Notice';
import { formatGBP } from '@/lib/format';
import type { CategorySpend } from '@/lib/hooks/useDashboardData';

interface SpendingByCategoryProps {
  data: CategorySpend[];
  /** ISO dates for the month, used for the links into Transactions. */
  dateFrom: string;
  dateTo: string;
  /** Rows shown before "Show all". */
  initialRows?: number;
}

export function categoryHref(categoryId: string, dateFrom: string, dateTo: string): string {
  return `/transactions?${new URLSearchParams({ dateFrom, dateTo, categoryId }).toString()}`;
}

/** Spending for the month, ranked, each row opening that category's transactions. */
export function SpendingByCategory({ data, dateFrom, dateTo, initialRows = 8 }: SpendingByCategoryProps) {
  const [showAll, setShowAll] = useState(false);
  const ranked = data.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);

  if (ranked.length === 0) {
    return (
      <EmptyState title="No spending this month yet">Categorised spending will be ranked here as it comes in.</EmptyState>
    );
  }

  const max = ranked[0].amount;
  const shown = showAll ? ranked : ranked.slice(0, initialRows);

  return (
    <div>
      <ul className="grid">
        {shown.map((c) => (
          <li key={c.categoryId}>
            <Link
              href={categoryHref(c.categoryId, dateFrom, dateTo)}
              className="group grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 rounded-md px-1 py-1.5 -mx-1 text-[13.5px] hover:bg-sunk focus-visible:outline-2 focus-visible:outline-accent max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-y-1"
            >
              <span className="truncate text-ink group-hover:underline">{c.categoryName}</span>
              <span className="h-1.5 rounded-full bg-line-2 max-sm:order-last max-sm:col-span-2" aria-hidden>
                <span className="block h-full rounded-full bg-ink-2" style={{ width: `${Math.max((c.amount / max) * 100, 1.5)}%` }} />
              </span>
              <span className="fig text-right text-ink">
                {formatGBP(c.amount)}
                <span className="ml-2 inline-block w-[3.2ch] text-ink-3">{Math.round(c.percentage)}%</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {ranked.length > initialRows && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-[13px] text-accent hover:underline">
          {showAll ? 'Show fewer' : `Show all ${ranked.length} categories`}
        </button>
      )}
    </div>
  );
}
