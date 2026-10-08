'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SidePanel } from '@/components/ui/SidePanel';
import { Notice, SkeletonRows } from '@/components/ui/Notice';
import { Button } from '@/components/ui/Button';
import { axisProps, chart, tooltipProps } from '@/lib/chart-theme';
import { formatAmount, formatGBP, formatGBPCompact, gbDate } from '@/lib/format';
import {
  detailLede,
  detailTransactionsHref,
  trendSentence,
  type CategoryDetail,
  type DetailMonth,
} from '@/lib/budgets/category-detail';

export interface BudgetLineTarget {
  categoryId: string;
  /** Shown while loading. */
  categoryName: string;
  year: number;
  /** null = the whole year. */
  month: number | null;
}

interface BudgetLinePanelProps {
  target: BudgetLineTarget | null;
  onClose: () => void;
}

const whole = (n: number) => formatGBP(n);

function ChartTooltip({ active, payload, isIncome }: { active?: boolean; payload?: Array<{ payload: DetailMonth }>; isIncome: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={tooltipProps.contentStyle} className="px-2.5 py-1.5">
      <div className="text-ink-2">
        {p.label} {p.year}
        {p.partial ? ' (so far)' : ''}
      </div>
      {!p.future && (
        <div className="fig text-ink">
          {formatGBP(p.actual)} {isIncome ? 'in' : 'spent'}
        </div>
      )}
      <div className="fig text-ink-3">{formatGBP(p.budget)} budget</div>
    </div>
  );
}

/** Actual per month as bars, budget as a dashed step line. Over-budget months in red. */
function MonthsChart({ d }: { d: CategoryDetail }) {
  const inc = d.category.isIncome;
  const data = d.months.map((p) => ({ ...p, bar: p.future ? null : p.actual }));
  const over = d.months.filter((p) => !p.future && !p.partial && p.budget > 0 && (inc ? p.actual < p.budget : p.actual > p.budget)).length;
  const done = d.months.filter((p) => !p.future && !p.partial && p.budget > 0).length;
  const caption =
    d.period.view === 'year'
      ? `${d.period.label} month by month: bars are ${inc ? 'money in' : 'spending'}, the dashed line is the budget.`
      : `The last 12 months: bars are ${inc ? 'money in' : 'spending'}, the dashed line is the budget.`;
  const tail =
    done > 0
      ? inc
        ? ` Short of plan in ${over} of ${done} months.`
        : ` Over budget in ${over} of ${done} months.`
      : '';

  return (
    <figure className="grid gap-2">
      <div className="h-[180px] w-full" role="img" aria-label={caption + tail}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%">
            <XAxis dataKey="label" {...axisProps} axisLine={false} interval="preserveStartEnd" minTickGap={4} tick={{ ...axisProps.tick, fontSize: 11 }} />
            <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={(n: number) => formatGBPCompact(n)} tick={{ ...axisProps.tick, fontSize: 11 }} tickCount={4} />
            <Tooltip content={<ChartTooltip isIncome={inc} />} cursor={tooltipProps.cursor} />
            <Bar dataKey="bar" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={22}>
              {data.map((p) => {
                const bad = p.budget > 0 && (inc ? false : p.actual > p.budget);
                const colour = inc ? chart.in : bad ? chart.bad : chart.out;
                return p.partial ? (
                  <Cell key={p.key} fill="transparent" stroke={colour} strokeWidth={1.5} strokeDasharray="3 2" />
                ) : (
                  <Cell key={p.key} fill={colour} />
                );
              })}
            </Bar>
            <Line dataKey="budget" type="step" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-[12.5px] text-ink-3">
        {caption}
        {tail}
        {d.months.some((p) => p.partial) ? ' The outlined bar is this month so far.' : ''}
      </figcaption>
    </figure>
  );
}

function Figures({ d }: { d: CategoryDetail }) {
  const inc = d.category.isIncome;
  const against = d.budgetToDate ?? d.budget;
  const diff = d.actual - against;
  const diffTone = Math.abs(diff) < 0.5 ? 'text-ink' : inc ? (diff > 0 ? 'text-in' : 'text-warn') : diff > 0 ? 'text-bad' : 'text-ink';
  const diffWord = Math.abs(diff) < 0.5 ? 'On budget' : inc ? (diff > 0 ? 'Above plan' : 'Short of plan') : diff > 0 ? 'Over' : 'Under';
  const cell = 'grid gap-0.5';
  return (
    <dl className="grid grid-cols-3 gap-3 border-y border-line-2 py-3">
      <div className={cell}>
        <dt className="text-[12px] text-ink-3">{d.budgetToDate !== null ? 'Budget to date' : 'Budget'}</dt>
        <dd className="fig text-[17px] text-ink">{whole(against)}</dd>
        {d.budgetToDate !== null && <dd className="text-[11.5px] text-ink-3">of <span className="fig">{whole(d.budget)}</span> for the year</dd>}
      </div>
      <div className={cell}>
        <dt className="text-[12px] text-ink-3">Actual</dt>
        <dd className={`fig text-[17px] ${inc ? 'text-in' : 'text-ink'}`}>{whole(d.actual)}</dd>
      </div>
      <div className={cell}>
        <dt className="text-[12px] text-ink-3">{diffWord}</dt>
        <dd className={`fig text-[17px] ${diffTone}`}>{whole(Math.abs(diff))}</dd>
      </div>
    </dl>
  );
}

/**
 * Detail for one budget line (opened from any budget row): budget vs actual,
 * 12 months as a chart, the trend, the latest transactions and a link to the
 * Transactions page filtered to this category and period.
 */
export function BudgetLinePanel({ target, onClose }: BudgetLinePanelProps) {
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    const q = new URLSearchParams({ year: String(target.year) });
    if (target.month) q.set('month', String(target.month));
    fetch(`/api/budgets/category/${target.categoryId}?${q.toString()}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.error || 'Could not load this budget line.');
        return body as CategoryDetail;
      })
      .then((d) => !cancelled && setDetail(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load this budget line.'));
    return () => {
      cancelled = true;
    };
  }, [target, attempt]);

  const d = detail && target && detail.category.id === target.categoryId ? detail : null;
  const href = d ? detailTransactionsHref(d) : null;
  const lede = d ? detailLede(d, whole) : null;
  const trend = d ? trendSentence(d, whole) : null;
  const periodWords = d ? `in ${d.period.label}` : '';

  return (
    <SidePanel
      open={target !== null}
      onClose={onClose}
      widthClassName="sm:max-w-lg"
      title={
        <span className="grid">
          <span>{d?.category.name ?? target?.categoryName}</span>
          {d && (
            <span className="text-[12.5px] font-normal text-ink-3">
              {d.category.groupName}
              {d.category.isIncome ? ' · income' : ''} · {d.period.label}
            </span>
          )}
        </span>
      }
      footer={
        href && d ? (
          <Link
            href={href}
            onClick={onClose}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-accent bg-accent px-3.5 text-sm font-semibold text-accent-ink hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {d.count === 0
              ? `Open transactions ${periodWords}`
              : `See ${d.count === 1 ? 'the 1 transaction' : `all ${d.count} transactions`} ${periodWords}`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      {error ? (
        <Notice tone="error" action={<Button size="sm" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}>
          {error}
        </Notice>
      ) : !d ? (
        <div aria-busy="true" className="grid gap-4">
          <SkeletonRows rows={2} />
          <div className="h-[180px] rounded-[3px] bg-sunk" />
          <SkeletonRows rows={3} />
        </div>
      ) : (
        <div className="grid gap-5">
          {lede && <p className="text-[14.5px] leading-snug text-ink">{lede.text}</p>}
          <Figures d={d} />
          <MonthsChart d={d} />
          {trend && <p className="text-[13.5px] text-ink-2">{trend}</p>}

          <section className="grid gap-1.5" aria-label="Latest transactions">
            <h3 className="border-t-[1.5px] border-ink pt-2 text-[13px] font-semibold text-ink">Latest transactions</h3>
            {d.recent.length === 0 ? (
              <p className="text-[13px] text-ink-3">No transactions in this category yet.</p>
            ) : (
              <ul role="list" className="divide-y divide-line-2">
                {d.recent.map((t) => (
                  <li key={t.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-[13px]">
                    <span className="text-ink-3">{gbDate(`${t.date}T00:00:00`, { day: 'numeric', month: 'short' })}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-ink" title={t.description}>
                        {t.description}
                      </span>
                      {t.account && <span className="block truncate text-[12px] text-ink-3">{t.account}</span>}
                    </span>
                    <span className={`fig whitespace-nowrap ${t.amount > 0 ? 'text-in' : 'text-ink'}`}>{formatAmount(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}
