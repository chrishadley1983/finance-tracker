'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

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

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function CapeScatterChart({
  cohorts,
  personalWr,
  ernDynamicWr,
  isLoading = false,
}: CapeScatterChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (!cohorts || cohorts.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
        SWR vs Starting CAPE
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Each dot is a historical retirement cohort. Lower CAPE = higher safe withdrawal rate.
      </p>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="cape"
              type="number"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              label={{ value: 'Starting CAPE', position: 'insideBottom', offset: -10, fill: '#9ca3af' }}
              domain={['auto', 'auto']}
            />
            <YAxis
              dataKey="swr"
              type="number"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatPct}
              label={{ value: 'SWR %', angle: -90, position: 'insideLeft', offset: 10, fill: '#9ca3af' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === 'swr') return [formatPct(v), 'SWR'];
                return [v.toFixed(1), 'CAPE'];
              }}
              labelFormatter={() => ''}
            />

            {/* Personal WR line */}
            {personalWr !== undefined && (
              <ReferenceLine
                y={personalWr}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: `Your WR: ${formatPct(personalWr)}`, fill: '#ef4444', fontSize: 11, position: 'right' }}
              />
            )}

            {/* ERN Dynamic WR line */}
            {ernDynamicWr !== undefined && (
              <ReferenceLine
                y={ernDynamicWr}
                stroke="#3b82f6"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: `ERN WR: ${formatPct(ernDynamicWr)}`, fill: '#3b82f6', fontSize: 11, position: 'left' }}
              />
            )}

            <Scatter
              data={cohorts}
              fill="#10b981"
              fillOpacity={0.6}
              r={3}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400">Historical cohort</span>
        </div>
        {personalWr !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5" style={{ borderTop: '2px dashed #ef4444' }} />
            <span className="text-gray-600 dark:text-gray-400">Your WR</span>
          </div>
        )}
        {ernDynamicWr !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5" style={{ borderTop: '2px dashed #3b82f6' }} />
            <span className="text-gray-600 dark:text-gray-400">ERN dynamic WR</span>
          </div>
        )}
      </div>
    </div>
  );
}
