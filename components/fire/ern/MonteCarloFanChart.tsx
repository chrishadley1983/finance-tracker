'use client';

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

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
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `£${(amount / 1_000).toFixed(0)}k`;
  if (amount <= 0) return '£0';
  return `£${amount.toFixed(0)}`;
}

function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MonteCarloFanChart({
  percentiles,
  worstPath,
  survivalRate,
  initialPortfolio,
  isLoading = false,
  retirementYear,
}: MonteCarloFanChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Running Monte Carlo...</div>
        </div>
      </div>
    );
  }

  if (!percentiles || percentiles.p50.length === 0) return null;

  const chartData = percentiles.p50.map((_, i) => ({
    year: i + 1,
    p5: percentiles.p5[i],
    p25: percentiles.p25[i],
    p50: percentiles.p50[i],
    p75: percentiles.p75[i],
    p95: percentiles.p95[i],
    worst: worstPath[i] ?? 0,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Monte Carlo Fan Chart
        </h3>
        <span className={`text-sm font-medium px-2 py-1 rounded ${
          survivalRate >= 95
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
            : survivalRate >= 80
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {survivalRate.toFixed(1)}% survival
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        500 simulated paths with block-bootstrap resampling
      </p>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="year"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              label={{ value: 'Years into Retirement', position: 'insideBottom', offset: -5, fill: '#9ca3af' }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  p95: '95th percentile',
                  p75: '75th percentile',
                  p50: 'Median',
                  p25: '25th percentile',
                  p5: '5th percentile',
                  worst: 'Worst path',
                };
                return [formatCurrencyFull(Number(value)), labels[String(name)] || String(name)];
              }}
              labelFormatter={(year) => `Year ${year}`}
            />

            <ReferenceLine
              y={initialPortfolio}
              stroke="#6b7280"
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            {/* Accumulation → Drawdown transition */}
            {retirementYear && retirementYear > 0 && (
              <ReferenceLine
                x={retirementYear}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{
                  value: 'Retirement',
                  position: 'top',
                  fill: '#f59e0b',
                  fontSize: 11,
                }}
              />
            )}

            {/* 5th-95th band */}
            <Area type="monotone" dataKey="p95" stroke="none" fill="#10b981" fillOpacity={0.08} />
            <Area type="monotone" dataKey="p5" stroke="none" fill="#ffffff" fillOpacity={1} />

            {/* 25th-75th band */}
            <Area type="monotone" dataKey="p75" stroke="none" fill="#10b981" fillOpacity={0.15} />
            <Area type="monotone" dataKey="p25" stroke="none" fill="#ffffff" fillOpacity={1} />

            {/* Median fill */}
            <Area type="monotone" dataKey="p50" stroke="none" fill="#10b981" fillOpacity={0.25} />

            {/* Lines */}
            <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={3} dot={false} name="p50" />
            <Line type="monotone" dataKey="p5" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="p5" />
            <Line type="monotone" dataKey="p95" stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" dot={false} name="p95" />
            <Line type="monotone" dataKey="worst" stroke="#ef4444" strokeWidth={2} dot={false} name="worst" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400">Median</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-emerald-500/20 rounded" />
          <span className="text-gray-600 dark:text-gray-400">25th-75th</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-red-500" />
          <span className="text-gray-600 dark:text-gray-400">Worst path</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-gray-500" style={{ borderTop: '2px dashed #6b7280' }} />
          <span className="text-gray-600 dark:text-gray-400">Initial portfolio</span>
        </div>
        {retirementYear && retirementYear > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5" style={{ borderTop: '2px dashed #f59e0b' }} />
            <span className="text-gray-600 dark:text-gray-400">Retirement</span>
          </div>
        )}
      </div>
    </div>
  );
}
