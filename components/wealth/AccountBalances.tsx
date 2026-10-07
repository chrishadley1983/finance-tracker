'use client';

import { ChevronRight } from 'lucide-react';
import type { NetWorthSummary } from '@/lib/types/fire';
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/fire';
import { formatGBP } from '@/lib/format';
import { SkeletonRows } from '@/components/ui/Notice';
import { groupByType } from './net-worth-helpers';

interface AccountBalancesProps {
  data: NetWorthSummary | null;
  isLoading?: boolean;
}

function sharePct(share: number): string {
  const pct = share * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

/**
 * Net worth by account type, largest first. Each type opens to show its
 * accounts. A thin bar shows the type's share of the total.
 */
export function AccountBalances({ data, isLoading = false }: AccountBalancesProps) {
  if (isLoading && !data) return <SkeletonRows rows={5} />;
  if (!data || data.byAccount.length === 0) {
    return <p className="py-4 text-sm text-ink-3">No accounts count towards net worth yet. Mark accounts as included on the Accounts page.</p>;
  }

  const groups = groupByType(data.byAccount);

  return (
    <ol className="divide-y divide-line-2">
      {groups.map((g) => (
        <li key={g.type}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5 focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform group-open:rotate-90" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-ink">{ACCOUNT_TYPE_LABELS[g.type] ?? g.type}</span>
                  <span className={`fig shrink-0 text-sm text-ink`}>{formatGBP(g.total)}</span>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="relative h-1 flex-1 rounded-full bg-line-2" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full bg-ink-3" style={{ width: `${g.share * 100}%` }} />
                  </span>
                  <span className="fig w-9 shrink-0 text-right text-[11.5px] text-ink-3">{sharePct(g.share)}</span>
                </span>
              </span>
            </summary>
            <ul className="mb-2 ml-5 grid gap-1 border-l border-line-2 pl-3">
              {g.accounts.map((a) => (
                <li key={a.accountId} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-ink-2">{a.accountName}</span>
                  <span className={`fig shrink-0 text-ink-2`}>{formatGBP(a.balance)}</span>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ol>
  );
}
