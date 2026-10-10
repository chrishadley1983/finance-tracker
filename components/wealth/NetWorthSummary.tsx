'use client';

import type { NetWorthHistoryPoint, NetWorthSummary as NetWorthSummaryType } from '@/lib/types/fire';
import { formatDateGB, formatGBP } from '@/lib/format';
import { describeChange, netWorthChanges } from './net-worth-helpers';

interface NetWorthSummaryProps {
  data: NetWorthSummaryType | null;
  /** Monthly history, used for the change since January. */
  history?: NetWorthHistoryPoint[];
  isLoading?: boolean;
}

function Change({ amount, label, first = false }: { amount: number; label: string; first?: boolean }) {
  const text = describeChange(amount, (n) => formatGBP(n));
  const [w, ...rest] = text.split(' ');
  const word = first ? w[0].toUpperCase() + w.slice(1) : w;
  if (rest.length === 0) return <>{word} {label}</>;
  return (
    <>
      {word} <span className={`fig font-medium ${amount > 0 ? 'text-in' : 'text-ink'}`}>{rest.join(' ')}</span> {label}
    </>
  );
}

/** The page's one headline figure, with this month's and this year's change in a sentence. */
export function NetWorthSummary({ data, history = [], isLoading = false }: NetWorthSummaryProps) {
  if (isLoading && !data) {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Loading net worth">
        <div className="h-4 w-24 animate-pulse rounded bg-line-2" />
        <div className="h-10 w-56 animate-pulse rounded bg-line-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-line-2" />
      </div>
    );
  }
  if (!data) return null;

  const changes = netWorthChanges(data.total, data.change, history);
  const pct = data.changePercent;

  return (
    <div>
      <p className="text-[13px] text-ink-3">Net worth today</p>
      <p className="fig mt-0.5 text-[34px] font-medium leading-tight tracking-tight text-ink sm:text-[40px]" title={formatGBP(data.total, { pence: true })}>
        {formatGBP(data.total)}
      </p>
      <p className="mt-1.5 max-w-[70ch] text-[14.5px] text-ink-2">
        {changes.month === null && changes.year === null ? (
          <>Add month-end balances for a few months to see how it&apos;s changing.</>
        ) : (
          <>
            {changes.month !== null && (
              <>
                <Change amount={changes.month} label="since last month" first />
                {pct !== null && Math.round(changes.month) !== 0 && <span className="text-ink-3"> ({Math.abs(pct) < 10 ? Math.abs(pct).toFixed(1) : Math.round(Math.abs(pct))}%)</span>}
              </>
            )}
            {changes.month !== null && changes.year !== null && ', and '}
            {changes.year !== null && <Change amount={changes.year} label="since January" first={changes.month === null} />}
            .
          </>
        )}
        {data.date && <span className="text-ink-3"> As of {formatDateGB(data.date)}.</span>}
      </p>
    </div>
  );
}
