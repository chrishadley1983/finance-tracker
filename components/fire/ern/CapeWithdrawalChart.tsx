'use client';

import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisProps, chart, gridProps, tooltipProps } from '@/lib/chart-theme';
import { Panel } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Notice';
import { readablePct } from '../readable';

interface CapeWithdrawalPoint {
  cape: number;
  withdrawalRate: number;
}

interface CapeWithdrawalChartProps {
  curve: CapeWithdrawalPoint[];
  currentCape?: number;
  currentWr?: number;
  isLoading?: boolean;
}

export function CapeWithdrawalChart({ curve, currentCape, currentWr, isLoading = false }: CapeWithdrawalChartProps) {
  if (isLoading) {
    return (
      <Panel title="How the adjusted rate moves with valuations">
        <SkeletonRows rows={6} />
      </Panel>
    );
  }
  if (!curve || curve.length === 0) return null;

  return (
    <Panel title="How the adjusted rate moves with valuations">
      <p className="mb-3 max-w-[75ch] text-[13px] text-ink-2">
        ERN&apos;s rule: withdrawal rate = 1.75% + half of 1/CAPE. The pricier the market, the lower the rate.
        {currentCape !== undefined && currentWr !== undefined && (
          <>
            {' '}
            Today&apos;s CAPE of <span className="fig">{currentCape.toFixed(1)}</span> gives{' '}
            <span className="fig">{readablePct(currentWr)}</span>.
          </>
        )}
      </p>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 16, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="cape"
              type="number"
              domain={['dataMin', 'dataMax']}
              {...axisProps}
              label={{ value: 'CAPE', position: 'insideBottom', offset: -12, fill: chart.axis, fontSize: 12 }}
            />
            <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={(v: number) => `${v.toFixed(1)}%`} domain={['auto', 'auto']} />
            <Tooltip
              {...tooltipProps}
              cursor={{ stroke: chart.grid }}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Withdrawal rate']}
              labelFormatter={(cape) => `CAPE ${cape}`}
            />
            {currentCape !== undefined && (
              <ReferenceLine
                x={currentCape}
                stroke={chart.series[2]}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: `Today ${currentCape.toFixed(0)}`, fill: chart.series[2], fontSize: 11, position: 'top' }}
              />
            )}
            <Line type="monotone" dataKey="withdrawalRate" stroke={chart.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chart.accent }} isAnimationActive={false} />
            {currentCape !== undefined && currentWr !== undefined && (
              <ReferenceDot x={currentCape} y={currentWr} r={5} fill={chart.surface} stroke={chart.series[2]} strokeWidth={2} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
