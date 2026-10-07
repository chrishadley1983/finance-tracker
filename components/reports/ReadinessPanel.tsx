'use client';

import Link from 'next/link';
import { Check, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MonthSwitcher } from '@/components/ui/MonthSwitcher';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { MONTH_NAMES } from '@/lib/format';
import { readinessChecklist, readinessHeadline } from '@/lib/reports/readiness-items';
import type { MonthReadiness } from '@/lib/reports/readiness';

export type ReadinessState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: MonthReadiness };

interface ReadinessPanelProps {
  /** YYYY-MM */
  month: string;
  /** Latest month that can be chosen (YYYY-MM). */
  maxMonth: string;
  onMonthChange: (month: string) => void;
  readiness: ReadinessState;
  onRetry: () => void;
  onGenerate: () => void;
  generating: boolean;
}

/** Pick a month, see whether its data is all in, and generate its report. */
export function ReadinessPanel({ month, maxMonth, onMonthChange, readiness, onRetry, onGenerate, generating }: ReadinessPanelProps) {
  const [y, m] = month.split('-').map(Number);
  const monthName = m ? MONTH_NAMES[m - 1] : '';

  return (
    <div className="grid gap-4">
      <MonthSwitcher value={month} max={maxMonth} min="2000-01" size="md" ariaLabel="Report month" className="-ml-2" onChange={onMonthChange} />

      {readiness.status === 'loading' && (
        <div aria-label={`Checking ${monthName} ${y}`}>
          <SkeletonRows rows={4} />
        </div>
      )}

      {readiness.status === 'error' && (
        <Notice tone="error" action={<Button size="sm" onClick={onRetry}>Try again</Button>}>
          {readiness.message}
        </Notice>
      )}

      {readiness.status === 'ready' && (
        <>
          <p className="text-sm text-ink-2" data-testid="readiness-headline">
            {readinessHeadline(readiness.data)}
          </p>
          <ul role="list" aria-label={`${readiness.data.monthLabel} checklist`} className="grid gap-2.5">
            {readinessChecklist(readiness.data).map((item) => (
              <li key={item.key} data-ok={item.ok} className="flex items-start gap-2 text-[13px]">
                {item.ok ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-in" aria-label="Done" />
                ) : (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="To do" />
                )}
                <span className={`min-w-0 ${item.ok ? 'text-ink-3' : 'text-ink'}`}>
                  {item.text}
                  {item.href && (
                    <>
                      {' '}
                      <Link href={item.href} className="whitespace-nowrap text-accent underline-offset-2 hover:underline">
                        {item.linkLabel ?? 'Fix'}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {readiness.data.action === 'none' ? (
              <>
                <Link
                  href={`/reports/${month}`}
                  className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3.5 text-sm text-ink hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Open the report
                </Link>
                <Button variant="ghost" onClick={onGenerate} loading={generating}>
                  Regenerate
                </Button>
              </>
            ) : readiness.data.ready ? (
              <Button variant="primary" onClick={onGenerate} loading={generating}>
                {readiness.data.reportExists ? `Regenerate ${monthName} report` : `Generate ${monthName} report`}
              </Button>
            ) : (
              <>
                <Button onClick={onGenerate} loading={generating}>
                  Generate anyway
                </Button>
                <span className="text-[12.5px] text-ink-3">The report will only include what is in so far.</span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
