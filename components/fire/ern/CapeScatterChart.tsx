'use client';

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { axisProps, chart, gridProps, tooltipProps } from '@/lib/chart-theme';
import { Panel } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Notice';
import { readablePct } from '../readable';

interface CapeScatterPoint {
  cape: number;
  swr: number;
  startIndex: number;
}

interface CapeScatterChartProps {
  cohorts: CapeScatterPoint[];
  personalWr?: number;
  ernDynamicWr?: number;
  isLoading?: boolean;
}

/** Start month of a cohort: index 0 is January 1871 (the first month of the Shiller data). */
export function cohortStartLabel(startIndex: number): string {
  const year = 1871 + Math.floor(startIndex / 12);
  const m = startIndex % 12;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m]} ${year}`;
}

export function CapeScatterChart({ cohorts, personalWr, ernDynamicWr, isLoading = false }: CapeScatterChartProps) {
  if (isLoading) {
    return (
      <Panel title="Safe withdrawal rate against starting valuation">
        <SkeletonRows rows={6} />
      </Panel>
    );
  }
  if (!cohorts || cohorts.length === 0) return null;

  const firstYear = 1871 + Math.floor(Math.min(...cohorts.map((c) => c.startIndex)) / 12);
  // Keep both reference lines in view even when they sit outside the dots.
  const refs = [personalWr, ernDynamicWr].filter((v): v is number => v !== undefined);
  const yDomain: [(min: number) => number, (max: number) => number] = [
    (min) => Math.floor(Math.min(min, ...refs) - 0.5),
    (max) => Math.ceil(Math.max(max, ...refs)),
  ];
  const below = personalWr !== undefined ? cohorts.filter((c) => c.swr < personalWr).length : 0;

  return (
    <Panel title="Safe withdrawal rate against starting valuation">
      <p className="mb-3 max-w-[75ch] text-[13px] text-ink-2">
        Each dot is a month someone could have retired, from {firstYear} on: how expensive shares were then (CAPE) and the most they could
        safely have withdrawn. Cheaper markets left room for higher rates.
        {personalWr !== undefined && (
          <>
            {' '}
            <span className="fig">{below.toLocaleString('en-GB')}</span> of {cohorts.length.toLocaleString('en-GB')} months fall below your rate.
          </>
        )}
      </p>
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="cape"
              type="number"
              name="CAPE"
              {...axisProps}
              domain={['auto', 'auto']}
              label={{ value: 'CAPE when retiring', position: 'insideBottom', offset: -14, fill: chart.axis, fontSize: 12 }}
            />
            <YAxis dataKey="swr" type="number" name="Safe rate" {...axisProps} axisLine={false} width={44} tickFormatter={(v: number) => `${v}%`} domain={yDomain} allowDecimals={false} />
            <ZAxis range={[14, 14]} />
            <Tooltip
              {...tooltipProps}
              cursor={{ stroke: chart.grid }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload as CapeScatterPoint | undefined;
                if (!p) return null;
                return (
                  <div style={tooltipProps.contentStyle} className="px-2.5 py-1.5">
                    <div style={tooltipProps.labelStyle}>Retiring {cohortStartLabel(p.startIndex)}</div>
                    <div>CAPE {p.cape.toFixed(1)}</div>
                    <div>Safe rate {p.swr.toFixed(2)}%</div>
                  </div>
                );
              }}
            />
            {ernDynamicWr !== undefined && (
              <ReferenceLine
                y={ernDynamicWr}
                stroke={chart.series[2]}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: `Adjusted ${readablePct(ernDynamicWr)}`, fill: chart.series[2], fontSize: 11, position: 'insideBottomLeft' }}
              />
            )}
            {personalWr !== undefined && (
              <ReferenceLine
                y={personalWr}
                stroke={chart.accent}
                strokeWidth={2}
                label={{ value: `You ${readablePct(personalWr)}`, fill: chart.accent, fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Scatter data={cohorts} fill={chart.out} fillOpacity={0.35} shape="circle" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink-3 opacity-60" aria-hidden /> A retirement month
        </li>
        {personalWr !== undefined && (
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-accent" aria-hidden /> Your withdrawal rate
          </li>
        )}
        {ernDynamicWr !== undefined && (
          <li className="flex items-center gap-1.5">
            <svg width="16" height="2" aria-hidden>
              <line x1="0" y1="1" x2="16" y2="1" stroke={chart.series[2]} strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            Market-adjusted rate today
          </li>
        )}
      </ul>
    </Panel>
  );
}
