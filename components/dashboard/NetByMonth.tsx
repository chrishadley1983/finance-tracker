'use client';

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/ui/Notice';
import { axisProps, chart, tooltipProps } from '@/lib/chart-theme';
import { formatGBP, formatGBPCompact } from '@/lib/format';
import { netCaption, netSeries, type NetPoint, type TrendPoint } from '@/lib/dashboard/overview';

const compact = (n: number) => (n < 0 ? `-${formatGBPCompact(-n)}` : formatGBPCompact(n));

function TooltipBody({ active, payload }: { active?: boolean; payload?: Array<{ payload: NetPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={tooltipProps.contentStyle} className="px-2.5 py-1.5">
      <div className="text-ink-2">{p.label}</div>
      <div className={`fig ${p.net < 0 ? 'text-bad' : 'text-ink'}`}>
        {p.empty ? 'No data' : `${formatGBP(p.net, { signed: true })} ${p.net < 0 ? 'more out than in' : 'kept'}`}
      </div>
    </div>
  );
}

/** Income minus spending per month, last 12 months; the current month is outlined. */
export function NetByMonth({ trend }: { trend: TrendPoint[] }) {
  const series = netSeries(trend);
  const caption = netCaption(series);

  if (series.every((p) => p.empty)) {
    return (
      <EmptyState title="No months to show yet">
        Once transactions are imported, each month&apos;s income minus spending appears here.
      </EmptyState>
    );
  }

  return (
    <figure>
      <div className="h-[200px] w-full" role="img" aria-label={caption ?? 'Income minus spending for each of the last 12 months'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <XAxis
              dataKey="label"
              {...axisProps}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={6}
              tick={{ ...axisProps.tick, fontSize: 11 }}
            />
            <YAxis {...axisProps} axisLine={false} width={44} tickFormatter={compact} tick={{ ...axisProps.tick, fontSize: 11 }} tickCount={4} />
            <ReferenceLine y={0} stroke={chart.axis} strokeWidth={1} />
            <Tooltip content={<TooltipBody />} cursor={tooltipProps.cursor} />
            <Bar dataKey="net" radius={[3, 3, 3, 3]} isAnimationActive={false} maxBarSize={28}>
              {series.map((p) => {
                const colour = p.net < 0 ? chart.bad : chart.in;
                return p.partial ? (
                  <Cell key={p.label} fill="transparent" stroke={colour} strokeWidth={1.5} strokeDasharray="3 2" />
                ) : (
                  <Cell key={p.label} fill={colour} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {caption && <figcaption className="mt-2 text-[13px] text-ink-2">{caption}</figcaption>}
    </figure>
  );
}
