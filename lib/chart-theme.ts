/**
 * Chart colours for Recharts/SVG. They reference the CSS tokens, so charts
 * follow light/dark automatically. Use these instead of hex literals.
 */
export const chart = {
  accent: 'var(--accent)',
  in: 'var(--in)',
  out: 'var(--ink-3)',
  bad: 'var(--bad)',
  warn: 'var(--warn)',
  grid: 'var(--line-2)',
  axis: 'var(--ink-3)',
  text: 'var(--ink-2)',
  surface: 'var(--surface)',
  series: ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)', 'var(--cat-6)', 'var(--cat-7)'],
} as const;

/** Shared Recharts props: quiet grid, readable ticks, tooltip on surface. */
export const axisProps = {
  stroke: 'var(--line)',
  tick: { fill: 'var(--ink-3)', fontSize: 12 },
  tickLine: false,
} as const;

export const gridProps = { stroke: 'var(--line-2)', strokeDasharray: '0', vertical: false } as const;

export const tooltipProps = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 4,
    color: 'var(--ink)',
    fontSize: 12.5,
  },
  labelStyle: { color: 'var(--ink-2)' },
  cursor: { fill: 'var(--line-2)' },
} as const;

export function seriesColour(i: number): string {
  return chart.series[i % chart.series.length];
}
