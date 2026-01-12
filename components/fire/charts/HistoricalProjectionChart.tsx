'use client';

import { useState } from 'react';
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
import { Layers, GitBranch } from 'lucide-react';
import type { HistoricalSimulationResults } from '@/lib/types/fire';

interface HistoricalProjectionChartProps {
  results: HistoricalSimulationResults | null;
  isLoading?: boolean;
}

type ChartMode = 'fan' | 'spaghetti';

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
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

interface FanChartProps {
  results: HistoricalSimulationResults;
}

function FanChart({ results }: FanChartProps) {
  const chartData = results.percentilesByYear.map((point) => ({
    year: point.yearIndex,
    p10: point.p10,
    p25: point.p25,
    p50: point.p50,
    p75: point.p75,
    p90: point.p90,
    // For area stacking
    range10_25: point.p25 - point.p10,
    range25_50: point.p50 - point.p25,
    range50_75: point.p75 - point.p50,
    range75_90: point.p90 - point.p75,
  }));

  return (
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
              p90: '90th Percentile',
              p75: '75th Percentile',
              p50: 'Median',
              p25: '25th Percentile',
              p10: '10th Percentile',
            };
            return [formatCurrencyFull(Number(value)), labels[String(name)] || String(name)];
          }}
          labelFormatter={(year) => `Year ${year}`}
        />

        {/* Reference line at initial portfolio */}
        <ReferenceLine
          y={results.config.initialPortfolio}
          stroke="#6b7280"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {/* 10th-90th percentile band (lightest) */}
        <Area
          type="monotone"
          dataKey="p90"
          stackId="1"
          stroke="none"
          fill="#10b981"
          fillOpacity={0.1}
          name="p90"
        />
        <Area
          type="monotone"
          dataKey="p10"
          stackId="2"
          stroke="none"
          fill="#ffffff"
          fillOpacity={1}
          name="hide"
        />

        {/* Overlay with actual bands */}
        <Area
          type="monotone"
          dataKey="p75"
          stroke="none"
          fill="#10b981"
          fillOpacity={0.2}
        />
        <Area
          type="monotone"
          dataKey="p25"
          stroke="none"
          fill="#ffffff"
          fillOpacity={1}
        />
        <Area
          type="monotone"
          dataKey="p50"
          stroke="none"
          fill="#10b981"
          fillOpacity={0.3}
        />

        {/* Median line */}
        <Line
          type="monotone"
          dataKey="p50"
          stroke="#10b981"
          strokeWidth={3}
          dot={false}
          name="p50"
        />

        {/* 10th percentile line */}
        <Line
          type="monotone"
          dataKey="p10"
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
          name="p10"
        />

        {/* 90th percentile line */}
        <Line
          type="monotone"
          dataKey="p90"
          stroke="#10b981"
          strokeWidth={1}
          strokeDasharray="4 4"
          dot={false}
          name="p90"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface SpaghettiChartProps {
  results: HistoricalSimulationResults;
}

function SpaghettiChart({ results }: SpaghettiChartProps) {
  // Prepare data with all simulations as separate series
  const maxYears = results.config.retirementDuration;
  const chartData: Record<string, number | string>[] = [];

  for (let yearIndex = 0; yearIndex < maxYears; yearIndex++) {
    const point: Record<string, number | string> = { year: yearIndex };

    results.simulations.forEach((sim) => {
      if (sim.yearlyData[yearIndex]) {
        point[`sim_${sim.startYear}`] = sim.yearlyData[yearIndex].portfolioEnd;
      }
    });

    chartData.push(point);
  }

  // Separate successful and failed simulations
  const successfulSims = results.simulations.filter((s) => s.success);
  const failedSims = results.simulations.filter((s) => !s.success);

  return (
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
            const year = String(name).replace('sim_', '');
            return [formatCurrencyFull(Number(value)), `Started ${year}`];
          }}
          labelFormatter={(year) => `Year ${year}`}
        />

        {/* Reference line at initial portfolio */}
        <ReferenceLine
          y={results.config.initialPortfolio}
          stroke="#6b7280"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {/* Failed simulations (red) */}
        {failedSims.map((sim) => (
          <Line
            key={`fail_${sim.startYear}`}
            type="monotone"
            dataKey={`sim_${sim.startYear}`}
            stroke="#ef4444"
            strokeWidth={1}
            strokeOpacity={0.5}
            dot={false}
            connectNulls={false}
          />
        ))}

        {/* Successful simulations (green) */}
        {successfulSims.map((sim) => (
          <Line
            key={`success_${sim.startYear}`}
            type="monotone"
            dataKey={`sim_${sim.startYear}`}
            stroke="#10b981"
            strokeWidth={1}
            strokeOpacity={0.3}
            dot={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function HistoricalProjectionChart({
  results,
  isLoading = false,
}: HistoricalProjectionChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('fan');

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (!results || results.simulations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">
            No simulation data available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Portfolio Projection
        </h3>

        {/* Chart mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setChartMode('fan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              chartMode === 'fan'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Fan Chart</span>
          </button>
          <button
            onClick={() => setChartMode('spaghetti')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              chartMode === 'spaghetti'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">All Lines</span>
          </button>
        </div>
      </div>

      <div className="h-80">
        {chartMode === 'fan' ? (
          <FanChart results={results} />
        ) : (
          <SpaghettiChart results={results} />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm flex-wrap">
        {chartMode === 'fan' ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-emerald-500" />
              <span className="text-gray-600 dark:text-gray-400">Median</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-emerald-500/30 rounded" />
              <span className="text-gray-600 dark:text-gray-400">25th-75th %ile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500 border-dashed" style={{ borderTop: '2px dashed #ef4444' }} />
              <span className="text-gray-600 dark:text-gray-400">10th %ile</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-emerald-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Successful ({results.successfulSimulations})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Failed ({results.failedSimulations})
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-gray-500 border-dashed" style={{ borderTop: '2px dashed #6b7280' }} />
          <span className="text-gray-600 dark:text-gray-400">Initial Portfolio</span>
        </div>
      </div>
    </div>
  );
}
