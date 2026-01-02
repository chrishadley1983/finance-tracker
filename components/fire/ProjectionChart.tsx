'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type { FireResult } from '@/lib/types/fire';

interface ProjectionChartProps {
  result: FireResult | null;
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount.toFixed(0)}`;
}

export function ProjectionChart({ result, isLoading = false }: ProjectionChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (!result || result.projections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">
            No projection data available
          </p>
        </div>
      </div>
    );
  }

  const retirementAge = result.inputs.targetRetirementAge || 65;
  const targetNumber = result.targetNumber;

  // Prepare chart data
  const chartData = result.projections.map((p) => ({
    age: p.age,
    portfolio: p.portfolioEnd,
    contributions: p.contributions,
    withdrawals: p.withdrawals,
    isRetired: p.age >= retirementAge,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        Portfolio Projection
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="age"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              label={{ value: 'Age', position: 'insideBottom', offset: -5, fill: '#9ca3af' }}
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
                  portfolio: 'Portfolio',
                  contributions: 'Annual Contributions',
                  withdrawals: 'Annual Withdrawals',
                };
                return [formatCurrency(Number(value)), labels[String(name)] || String(name)];
              }}
              labelFormatter={(age) => `Age ${age}`}
            />

            {/* FI Target line */}
            <ReferenceLine
              y={targetNumber}
              stroke="#10b981"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: `FI Target: ${formatCurrency(targetNumber)}`,
                position: 'right',
                fill: '#10b981',
                fontSize: 12,
              }}
            />

            {/* Retirement age line */}
            <ReferenceLine
              x={retirementAge}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Retire @ ${retirementAge}`,
                position: 'top',
                fill: '#f59e0b',
                fontSize: 12,
              }}
            />

            {/* Portfolio line */}
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              name="portfolio"
            />

            {/* FI reached marker */}
            {result.fiAge && (
              <ReferenceLine
                x={result.fiAge}
                stroke="#8b5cf6"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: '🎉 FI',
                  position: 'top',
                  fill: '#8b5cf6',
                  fontSize: 12,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400">Portfolio Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-emerald-500 border-dashed" style={{ borderTop: '2px dashed #10b981' }} />
          <span className="text-gray-600 dark:text-gray-400">FI Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-amber-500 border-dashed" style={{ borderTop: '2px dashed #f59e0b' }} />
          <span className="text-gray-600 dark:text-gray-400">Retirement</span>
        </div>
      </div>
    </div>
  );
}
