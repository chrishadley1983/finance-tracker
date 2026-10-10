'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NetWorthHistoryPoint } from '@/lib/types/fire';
import { formatGBP } from '@/lib/format';
import { axisProps, chart, gridProps, tooltipProps } from '@/lib/chart-theme';
import { Button } from '@/components/ui/Button';
import { EmptyState, Notice } from '@/components/ui/Notice';
import { CHART_PERIODS, axisGBP, filterHistory, monthKey, monthLabel, shortMonthLabel, type ChartPeriod } from './net-worth-helpers';

interface NetWorthChartProps {
  history: NetWorthHistoryPoint[] | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  initialPeriod?: ChartPeriod;
}

interface LatestDotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

/** Quiet text tabs for the chart period. */
export function PeriodTabs({ value, onChange }: { value: ChartPeriod; onChange: (p: ChartPeriod) => void }) {
  return (
    <div role="group" aria-label="Chart period" className="flex gap-3 text-[12.5px]">
      {CHART_PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={value === p.id}
          onClick={() => onChange(p.id)}
          className={`rounded-sm focus-visible:outline-2 focus-visible:outline-accent ${
            value === p.id ? 'font-semibold text-ink underline decoration-[1.5px] underline-offset-[5px]' : 'text-ink-3 hover:text-ink-2'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function NetWorthChart({ history, isLoading = false, error = null, onRetry, initialPeriod = '2y' }: NetWorthChartProps) {
  const [period, setPeriod] = useState<ChartPeriod>(initialPeriod);

  const points = useMemo(() => filterHistory(history ?? [], period), [history, period]);
  const data = useMemo(
    () => points.map((p) => ({ date: p.date, label: shortMonthLabel(p.date), total: Math.round(p.total) })),
    [points]
  );
  const lastIndex = data.length - 1;
  const latestIsPartial = lastIndex >= 0 && data[lastIndex].date.slice(0, 7) === monthKey(new Date());

  const renderDot = (props: LatestDotProps) => {
    const { cx, cy, index } = props;
    if (index !== lastIndex || cx === undefined || cy === undefined) return <g key={`d${index}`} />;
    return (
      <g key="latest">
        <circle cx={cx} cy={cy} r={5} fill={latestIsPartial ? chart.surface : chart.accent} stroke={chart.accent} strokeWidth={2} />
      </g>
    );
  };

  let body: React.ReactNode;
  if (isLoading && !history) {
    body = <div className="h-64 animate-pulse rounded-[3px] bg-line-2" aria-busy="true" aria-label="Loading chart" />;
  } else if (error) {
    body = (
      <Notice tone="error" action={onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}>
        Couldn&apos;t load your net worth history. {error}
      </Notice>
    );
  } else if (data.length < 2) {
    body = (
      <EmptyState title="Not enough history to draw a chart yet">
        Enter month-end balances for at least two months and your net worth over time will appear here.
      </EmptyState>
    );
  } else {
    const first = data[0];
    const last = data[lastIndex];
    body = (
      <>
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} axisLine={false} width={60} tickFormatter={axisGBP} domain={['auto', 'auto']} />
              <Tooltip
                {...tooltipProps}
                cursor={{ stroke: chart.grid }}
                formatter={(value) => [formatGBP(Number(value)), 'Net worth']}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined;
                  return d ? monthLabel(d.slice(0, 7)) : '';
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={chart.accent}
                strokeWidth={2}
                fill={chart.accent}
                fillOpacity={0.08}
                dot={renderDot}
                activeDot={{ r: 4, fill: chart.accent, stroke: chart.surface }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Net worth at each month end, from {formatGBP(first.total)} in {monthLabel(first.date.slice(0, 7))} to{' '}
          {formatGBP(last.total)} {latestIsPartial ? 'so far this month (hollow dot)' : `in ${monthLabel(last.date.slice(0, 7))}`}.
        </p>
      </>
    );
  }

  return (
    <section aria-labelledby="nw-chart-title" className="min-w-0 border-t-[1.5px] border-ink">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
        <h2 id="nw-chart-title" className="text-[13.5px] font-semibold text-ink">
          Over time
        </h2>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      {body}
    </section>
  );
}
