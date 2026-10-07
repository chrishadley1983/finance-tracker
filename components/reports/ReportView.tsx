'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { PageIntro } from '@/components/ui/PageIntro';
import { Button } from '@/components/ui/Button';
import { Notice, EmptyState, SkeletonRows } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatGBP, MONTH_NAMES, gbDate } from '@/lib/format';

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

interface SavedReport {
  year: number;
  month: number;
  generatedAt: string | null;
  reportData: { net_worth_change?: number | null; savings_rate?: number | null } | null;
  html: string | null;
}

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ready'; report: SavedReport };

function savedAt(iso: string): string {
  const d = new Date(iso);
  const day = gbDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} at ${time}`;
}

/** One saved monthly report (its stored HTML), with Print and Regenerate. */
export function ReportView({ month }: { month: string }) {
  const { toast } = useToast();
  const match = MONTH.exec(month);
  const year = match ? Number(match[1]) : 0;
  const m = match ? Number(match[2]) : 0;
  const title = match ? `${MONTH_NAMES[m - 1]} ${year}` : '';

  const [state, setState] = useState<State>({ status: 'loading' });
  const [regenerating, setRegenerating] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!match) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/monthly-reports/${month}`, { cache: 'no-store' });
      if (res.status === 404) return setState({ status: 'missing' });
      if (!res.ok) throw new Error();
      const report = (await res.json()) as SavedReport;
      setFrameHeight(null);
      setState({ status: 'ready', report });
    } catch {
      setState({ status: 'error', message: `Could not load the ${title} report. Try again in a moment.` });
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const fitFrame = () => {
    try {
      const doc = frameRef.current?.contentDocument;
      const h = doc?.documentElement?.scrollHeight;
      if (h) setFrameHeight(h + 2);
    } catch {
      // cross-origin or not ready: keep the default height
    }
  };

  const print = () => {
    try {
      const win = frameRef.current?.contentWindow;
      if (!win) throw new Error('the report has not loaded yet');
      win.focus();
      win.print();
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't open printing (${err instanceof Error ? err.message : 'unknown error'}).` });
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/monthly-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month: m, save: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `the server answered ${res.status}`);
      }
      toast({ tone: 'success', message: `${title} report regenerated with today's figures.` });
      await load();
    } catch (err) {
      toast({ tone: 'error', message: `Couldn't regenerate the ${title} report (${err instanceof Error ? err.message : 'unknown error'}).` });
    } finally {
      setRegenerating(false);
    }
  };

  const back = (
    <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      All reports
    </Link>
  );

  if (!match) {
    return (
      <div className="grid gap-4">
        {back}
        <EmptyState title="That isn't a month we can show">Report addresses look like /reports/2026-09.</EmptyState>
      </div>
    );
  }

  const report = state.status === 'ready' ? state.report : null;
  const d = report?.reportData ?? {};
  const facts: string[] = [];
  if (d.net_worth_change != null && d.net_worth_change !== 0) {
    facts.push(`net worth ${d.net_worth_change > 0 ? 'up' : 'down'} ${formatGBP(Math.abs(d.net_worth_change))}`);
  }
  if (d.savings_rate != null) facts.push(`${Math.round(d.savings_rate)}% of income saved`);
  const factLine = facts.join(', ');

  return (
    <div className="grid gap-5 pb-8">
      {back}
      <PageIntro
        actions={
          state.status === 'ready' || state.status === 'missing' ? (
            <>
              {report?.html && (
                <Button onClick={print}>
                  <Printer className="h-4 w-4" aria-hidden />
                  Print
                </Button>
              )}
              <Button
                variant={state.status === 'missing' ? 'primary' : 'secondary'}
                onClick={() => (state.status === 'missing' ? void regenerate() : setConfirm(true))}
                loading={regenerating}
              >
                {state.status === 'missing' ? `Generate ${MONTH_NAMES[m - 1]} report` : 'Regenerate'}
              </Button>
            </>
          ) : undefined
        }
      >
        <p>
          <strong>{title}</strong>
          {report?.generatedAt ? ` report, saved ${savedAt(report.generatedAt)}.` : state.status === 'loading' ? ' report.' : ''}
          {factLine && ` ${factLine.charAt(0).toUpperCase()}${factLine.slice(1)}.`}
        </p>
      </PageIntro>

      {state.status === 'loading' && <SkeletonRows rows={8} />}

      {state.status === 'error' && (
        <Notice tone="error" action={<Button size="sm" onClick={() => void load()}>Try again</Button>}>
          {state.message}
        </Notice>
      )}

      {state.status === 'missing' && (
        <div className="rounded-[3px] border border-line bg-surface">
          <EmptyState title={`No saved report for ${title}`}>
            Generate it to keep a record of the month. <Link href={`/reports?month=${month}`} className="text-accent underline-offset-2 hover:underline">Check the month is complete first</Link>.
          </EmptyState>
        </div>
      )}

      {report && !report.html && (
        <Notice tone="info">This report was saved before reports kept their full page. Regenerate it to see it here.</Notice>
      )}

      {report?.html && (
        <iframe
          ref={frameRef}
          srcDoc={report.html}
          onLoad={fitFrame}
          title={`${title} report`}
          className="block w-full rounded-[3px] border border-line"
          style={{ height: frameHeight ?? '75vh' }}
        />
      )}

      <ConfirmDialog
        isOpen={confirm}
        title="Replace the saved report?"
        message={`A report for ${title} is already saved. Generating again replaces it with today's figures.`}
        confirmLabel="Replace report"
        variant="warning"
        onConfirm={() => {
          setConfirm(false);
          void regenerate();
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
