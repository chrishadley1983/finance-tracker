'use client';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Notice';
import { formatGBP, gbDate } from '@/lib/format';
import type { Transaction } from '@/lib/hooks/useDashboardData';

const shortDate = (iso: string) => gbDate(new Date(`${iso.slice(0, 10)}T00:00:00`), { day: 'numeric', month: 'short' });

/** The latest few transactions; ones without a category are marked. */
export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <EmptyState title="No transactions this month yet">New transactions appear here after a bank sync or import.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-line-2">
      {transactions.map((t) => {
        const amount = Number(t.amount);
        return (
          <li key={t.id} className="grid grid-cols-[3.4rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2 text-[13.5px]">
            <span className="text-[12.5px] text-ink-3">{shortDate(t.date)}</span>
            <span className="min-w-0">
              <span className="block truncate text-ink">{t.description}</span>
              {t.category ? (
                <span className="block truncate text-[12px] text-ink-3">{t.category.name}</span>
              ) : (
                <Chip tone="warn" className="mt-0.5">
                  Needs a category
                </Chip>
              )}
            </span>
            <span className={`fig text-right ${amount > 0 ? 'text-in' : 'text-ink'}`}>
              {amount > 0 ? formatGBP(amount, { pence: true, signed: true }) : formatGBP(Math.abs(amount), { pence: true })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
