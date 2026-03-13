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
} from 'recharts';

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

export function CapeWithdrawalChart({
  curve,
  currentCape,
  currentWr,
  isLoading = false,
}: CapeWithdrawalChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (!curve || curve.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
        CAPE-Based Dynamic Withdrawal Rate
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        ERN formula: WR = 1.75 + 0.50 × (1/CAPE) — adjusts spending to market valuation
      </p>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="cape"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              label={{ value: 'CAPE Ratio', position: 'insideBottom', offset: -10, fill: '#9ca3af' }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Withdrawal Rate']}
              labelFormatter={(cape) => `CAPE ${cape}`}
            />

            {/* Current CAPE marker */}
            {currentCape !== undefined && (
              <ReferenceLine
                x={currentCape}
                stroke="#3b82f6"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `Now: CAPE ${currentCape}`,
                  fill: '#3b82f6',
                  fontSize: 11,
                  position: 'top',
                }}
              />
            )}

            {/* Current WR marker */}
            {currentWr !== undefined && (
              <ReferenceLine
                y={currentWr}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}

            <Line
              type="monotone"
              dataKey="withdrawalRate"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400">ERN dynamic WR curve</span>
        </div>
        {currentCape !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5" style={{ borderTop: '2px dashed #3b82f6' }} />
            <span className="text-gray-600 dark:text-gray-400">Current CAPE ({currentCape})</span>
          </div>
        )}
      </div>
    </div>
  );
}
