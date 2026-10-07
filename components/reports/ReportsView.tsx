'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { PageIntro } from '@/components/ui/PageIntro';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Notice, EmptyState, SkeletonRows } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatDateGB, formatGBP, MONTH_NAMES } from '@/lib/format';
import { ReadinessPanel, type ReadinessState } from './ReadinessPanel';

export interface ReportSummary {
  year: number;
  month: number;
  report_data: {
    net_worth?: number | null;
    net_worth_change?: number | null;
    income?: number | null;
    expenses?: number | null;
    savings_rate?: number | null;
  } | null;
  generated_at: string | null;
}

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/;
const key = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const label = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`;

/** +£4,210 in the money-in colour; falls in ink with a minus. */
export function NetWorthChange({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="fig text-ink-3">–</span>;
  return <span className={`fig ${value > 0 ? 'text-in' : 'text-ink'}`}>{formatGBP(value, { signed: true })}</span>;
}

function Lede({ reports }: { reports: ReportSummary[] }) {
  if (reports.length === 0) {
    return <p>No monthly reports saved yet. Choose a month to check it is complete and generate its report.</p>;
  }
  const latest = reports[0];
  const d = latest.report_data ?? {};
  const parts: string[] = [];
  if (d.net_worth_change != null) {
    parts.push(
      d.net_worth_change === 0
        ? 'net worth unchanged'
        : `net worth ${d.net_worth_change > 0 ? 'up' : 'down'} ${formatGBP(Math.abs(d.net_worth_change))}`
    );
  }
  if (d.savings_rate != null) parts.push(`${Math.round(d.savings_rate)}% of income saved`);
  return (
    <p>
      <strong>
        {reports.length} saved report{reports.length === 1 ? '' : 's'}
      </strong>
      . The latest, {label(latest.year, latest.month)}
      {parts.length > 0 ? `, shows ${parts.join(' and ')}.` : '.'}
    </p>
  );
}

export function ReportsView({ now: nowProp }: { now?: Date } = {}) {
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const lastComplete = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return key(d.getFullYear(), d.getMonth() + 1);
  }, [now]);
  const thisMonth = key(now.getFullYear(), now.getMonth() + 1);
  const requested = params?.get('month');
  const [genMonth, setGenMonthState] = useState(requested && MONTH_PARAM.test(requested) && requested <= thisMonth ? requested : lastComplete);
  // The chosen month lives in the URL (?month=YYYY-MM) so it survives a refresh.
  const setGenMonth = useCallback(
    (month: string) => {
      setGenMonthState(month);
      router.replace(`/reports?month=${month}`, { scroll: false });
    },
    [router]
  );

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/monthly-reports/list', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load your saved reports. Try again in a moment.');
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your saved reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  // ---- Readiness for the chosen month ----------------------------------------
  const [readiness, setReadiness] = useState<ReadinessState>({ status: 'loading' });
  const readinessReq = useRef(0);
  const fetchReadiness = useCallback(async (month: string) => {
    const id = ++readinessReq.current;
    setReadiness({ status: 'loading' });
    const [y, m] = month.split('-').map(Number);
    try {
      const res = await fetch(`/api/monthly-reports/readiness?year=${y}&month=${m}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (id === readinessReq.current) setReadiness({ status: 'ready', data });
    } catch {
      if (id === readinessReq.current) {
        setReadiness({ status: 'error', message: `Could not check whether ${label(y, m)} is complete. You can still generate the report.` });
      }
    }
  }, []);

  useEffect(() => {
    void fetchReadiness(genMonth);
  }, [genMonth, fetchReadiness]);

  // ---- Generate ----------------------------------------------------------------
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [gy, gm] = genMonth.split('-').map(Number);
  const exists = reports.some((r) => r.year === gy && r.month === gm) || (readiness.status === 'ready' && readiness.data.reportExists);

  const generate = useCallback(
    async (overwriteConfirmed = false) => {
      // Stored reports are point-in-time records; don't replace one silently.
      if (!overwriteConfirmed && exists) {
        setConfirmOverwrite(true);
        return;
      }
      setIsGenerating(true);
      try {
        const res = await fetch('/api/monthly-reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: gy, month: gm, save: true }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `the server answered ${res.status}`);
        }
        const target = genMonth;
        toast({
          tone: 'success',
          message: `${label(gy, gm)} report saved.`,
          action: { label: 'Open', onClick: () => router.push(`/reports/${target}`) },
        });
        await Promise.all([fetchReports(), fetchReadiness(genMonth)]);
      } catch (err) {
        toast({ tone: 'error', message: `Couldn't generate the ${label(gy, gm)} report (${err instanceof Error ? err.message : 'unknown error'}). Try again.` });
      } finally {
        setIsGenerating(false);
      }
    },
    [exists, gy, gm, genMonth, toast, router, fetchReports, fetchReadiness]
  );

  return (
    <div className="grid gap-6 pb-8">
      <PageIntro>
        {isLoading ? <p>Loading your saved reports.</p> : <Lede reports={reports} />}
      </PageIntro>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel variant="boxed" title="Generate a report" className="lg:order-2">
          <ReadinessPanel
            month={genMonth}
            maxMonth={thisMonth}
            onMonthChange={setGenMonth}
            readiness={readiness}
            onRetry={() => void fetchReadiness(genMonth)}
            onGenerate={() => void generate()}
            generating={isGenerating}
          />
        </Panel>

        <Panel title="Saved reports" className="lg:order-1">
          {error ? (
            <Notice tone="error" action={<Button size="sm" onClick={() => void fetchReports()}>Try again</Button>}>
              {error}
            </Notice>
          ) : isLoading ? (
            <SkeletonRows rows={5} />
          ) : reports.length === 0 ? (
            <EmptyState title="No saved reports">
              Each month&apos;s report is saved here once it is generated, as a record of that month that later edits don&apos;t change.
            </EmptyState>
          ) : (
            <>
              <div
                aria-hidden
                className="grid grid-cols-[minmax(0,1fr)_7rem_4.5rem_1rem] gap-x-3 border-b border-line-2 pb-1.5 text-[12px] text-ink-3 md:grid-cols-[minmax(0,1fr)_8rem_6rem_7rem_1rem]"
              >
                <span>Month</span>
                <span className="text-right">Net worth</span>
                <span className="text-right">Saved</span>
                <span className="hidden text-right md:block">Generated</span>
                <span />
              </div>
              <ul role="list" aria-label="Saved reports">
                {reports.map((r) => {
                  const d = r.report_data ?? {};
                  return (
                    <li key={key(r.year, r.month)} className="border-b border-line-2 last:border-b-0">
                      <Link
                        href={`/reports/${key(r.year, r.month)}`}
                        className="grid grid-cols-[minmax(0,1fr)_7rem_4.5rem_1rem] items-baseline gap-x-3 py-2.5 text-[13.5px] hover:bg-sunk focus-visible:outline-2 focus-visible:outline-accent md:grid-cols-[minmax(0,1fr)_8rem_6rem_7rem_1rem]"
                      >
                        <span className="truncate font-medium text-ink">{label(r.year, r.month)}</span>
                        <span className="text-right">
                          <NetWorthChange value={d.net_worth_change} />
                        </span>
                        <span className="fig text-right text-ink-2">{d.savings_rate != null ? `${Math.round(d.savings_rate)}%` : '–'}</span>
                        <span className="hidden text-right text-[12.5px] text-ink-3 md:block">
                          {r.generated_at ? formatDateGB(r.generated_at) : ''}
                        </span>
                        <ChevronRight className="h-4 w-4 self-center text-ink-3" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[12.5px] text-ink-3">Net worth shows the change over the month; saved is the share of income kept.</p>
            </>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        isOpen={confirmOverwrite}
        title="Replace the saved report?"
        message={`A report for ${label(gy, gm)} is already saved. Generating again replaces it with today's figures.`}
        confirmLabel="Replace report"
        variant="warning"
        onConfirm={() => {
          setConfirmOverwrite(false);
          void generate(true);
        }}
        onCancel={() => setConfirmOverwrite(false)}
      />
    </div>
  );
}
