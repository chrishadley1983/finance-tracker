'use client';

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, chart, gridProps, tooltipProps } from '@/lib/chart-theme';
import { formatGBP } from '@/lib/format';
import { Chip } from '@/components/ui/Chip';
import { Panel } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Notice';
import { readableGBP, readablePct } from '../readable';

interface McPercentiles {
  p5: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
}

interface MonteCarloFanChartProps {
  percentiles: McPercentiles;
  worstPath: number[];
  survivalRate: number;
  initialPortfolio: number;
  isLoading?: boolean;
  retirementYear?: number;
  paths?: number;
}

const LABELS: Record<string, string> = {
  p95: 'Best 5%',
  p75: 'Upper quarter',
  p50: 'Median',
  p25: 'Lower quarter',
  p5: 'Worst 5%',
  worst: 'Worst path',
};

/** Round up to 1, 2, 2.5 or 5 times a power of ten, so axis ticks land on round numbers. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10;
  return step * p;
}

function axisGBP(v: number): string {
  if (v <= 0) return '£0';
  return readableGBP(v);
}

export function MonteCarloFanChart({
  percentiles,
  worstPath,
  survivalRate,
  initialPortfolio,
  isLoading = false,
  retirementYear,
  paths = 500,
}: MonteCarloFanChartProps) {
  if (isLoading) {
    return (
      <Panel title="Simulated futures">
        <SkeletonRows rows={6} />
      </Panel>
    );
  }
  if (!percentiles || percentiles.p50.length === 0) return null;

  const chartData = percentiles.p50.map((_, i) => ({
    year: i + 1,
    outer: [Math.max(0, percentiles.p5[i]), Math.max(0, percentiles.p95[i])] as [number, number],
    inner: [Math.max(0, percentiles.p25[i]), Math.max(0, percentiles.p75[i])] as [number, number],
    p5: percentiles.p5[i],
    p25: percentiles.p25[i],
    p50: percentiles.p50[i],
    p75: percentiles.p75[i],
    p95: percentiles.p95[i],
    worst: Math.max(0, worstPath[i] ?? 0),
  }));
  const last = chartData[chartData.length - 1];
  // The best 5% of futures can grow huge; cap the axis so the middle of the fan stays readable.
  const yMax = niceCeil(Math.max(initialPortfolio, ...chartData.map((d) => d.p75)) * 1.3);
  const capped = chartData.some((d) => d.p95 > yMax);
  const tone = survivalRate >= 95 ? 'in' : survivalRate >= 85 ? 'warn' : 'bad';

  return (
    <Panel title="Simulated futures" action={<Chip tone={tone}>{readablePct(survivalRate)} last the distance</Chip>}>
      <p className="mb-3 max-w-[75ch] text-[13px] text-ink-2">
        {paths.toLocaleString('en-GB')} possible futures built from real historical returns, in today&apos;s money. After{' '}
        {last.year} years the median ends near <span className="fig">{readableGBP(last.p50)}</span>
        {last.p5 > 1000 ? (
          <>
            ; the worst 5% end below <span className="fig">{readableGBP(last.p5)}</span>.
          </>
        ) : (
          <>; the worst 5% run out of money.</>
        )}
        {capped && <> The best outcomes run off the top of the chart; hover for the figures.</>}
      </p>
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="year"
              {...axisProps}
              minTickGap={16}
              label={{ value: 'Years from now', position: 'insideBottom', offset: -12, fill: chart.axis, fontSize: 12 }}
            />
            <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={axisGBP} domain={[0, yMax]} allowDataOverflow />
            <Tooltip
              {...tooltipProps}
              cursor={{ stroke: chart.grid }}
              content={({ active, payload, label }) => {
                const d = active && (payload?.[0]?.payload as (typeof chartData)[number] | undefined);
                if (!d) return null;
                return (
                  <div style={tooltipProps.contentStyle} className="grid gap-0.5 px-2.5 py-1.5">
                    <div style={tooltipProps.labelStyle}>Year {label}</div>
                    {(['p95', 'p75', 'p50', 'p25', 'p5', 'worst'] as const).map((k) => (
                      <div key={k} className="flex justify-between gap-4">
                        <span>{LABELS[k]}</span>
                        <span className="fig">{formatGBP(Math.max(0, d[k]))}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <ReferenceLine y={initialPortfolio} stroke={chart.axis} strokeDasharray="4 4" strokeWidth={1} />
            {retirementYear && retirementYear > 0 && (
              <ReferenceLine
                x={retirementYear}
                stroke={chart.text}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: 'Retire', position: 'top', fill: chart.text, fontSize: 11 }}
              />
            )}
            <Area type="monotone" dataKey="outer" stroke="none" fill={chart.accent} fillOpacity={0.1} isAnimationActive={false} />
            <Area type="monotone" dataKey="inner" stroke="none" fill={chart.accent} fillOpacity={0.2} isAnimationActive={false} />
            <Line type="monotone" dataKey="p50" stroke={chart.accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="worst" stroke={chart.bad} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" aria-hidden /> Median
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[2px] bg-accent opacity-30" aria-hidden /> Middle half
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[2px] bg-accent opacity-15" aria-hidden /> 90% of futures
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-bad" aria-hidden /> Worst path
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="16" height="2" aria-hidden>
            <line x1="0" y1="1" x2="16" y2="1" stroke={chart.axis} strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          Today&apos;s pot ({readableGBP(initialPortfolio)})
        </li>
      </ul>
    </Panel>
  );
}
