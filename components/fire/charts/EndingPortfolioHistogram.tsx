'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { HistoricalSimulationResults } from '@/lib/types/fire';

interface EndingPortfolioHistogramProps {
  results: HistoricalSimulationResults | null;
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

interface HistogramBin {
  label: string;
  range: string;
  count: number;
  percentage: number;
  isFailed: boolean;
  minValue: number;
  maxValue: number;
}

function createHistogramBins(results: HistoricalSimulationResults): HistogramBin[] {
  const finalValues = results.simulations.map(s => s.finalPortfolioValue);
  const initialPortfolio = results.config.initialPortfolio;

  // Separate failed (0) and successful simulations
  const failedCount = finalValues.filter(v => v === 0).length;
  const successfulValues = finalValues.filter(v => v > 0);

  if (successfulValues.length === 0 && failedCount === 0) {
    return [];
  }

  const bins: HistogramBin[] = [];
  const totalCount = results.totalSimulations;

  // Add failed bin if there are failures
  if (failedCount > 0) {
    bins.push({
      label: 'Failed',
      range: '£0',
      count: failedCount,
      percentage: (failedCount / totalCount) * 100,
      isFailed: true,
      minValue: 0,
      maxValue: 0,
    });
  }

  // Create bins for successful simulations
  if (successfulValues.length > 0) {
    const maxValue = Math.max(...successfulValues);
    const minValue = Math.min(...successfulValues);

    // Create ~8 bins for successful values
    const numBins = 8;
    const binSize = (maxValue - minValue) / numBins;

    // If all values are similar, create a single bin
    if (binSize < initialPortfolio * 0.1) {
      const count = successfulValues.length;
      bins.push({
        label: formatCurrency(minValue),
        range: `${formatCurrency(minValue)} - ${formatCurrency(maxValue)}`,
        count,
        percentage: (count / totalCount) * 100,
        isFailed: false,
        minValue,
        maxValue,
      });
    } else {
      for (let i = 0; i < numBins; i++) {
        const binMin = minValue + i * binSize;
        const binMax = i === numBins - 1 ? maxValue + 1 : minValue + (i + 1) * binSize;

        const count = successfulValues.filter(v => v >= binMin && v < binMax).length;

        if (count > 0) {
          bins.push({
            label: formatCurrency(binMin + binSize / 2),
            range: `${formatCurrency(binMin)} - ${formatCurrency(binMax)}`,
            count,
            percentage: (count / totalCount) * 100,
            isFailed: false,
            minValue: binMin,
            maxValue: binMax,
          });
        }
      }
    }
  }

  return bins;
}

export function EndingPortfolioHistogram({
  results,
  isLoading = false,
}: EndingPortfolioHistogramProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading histogram...</div>
        </div>
      </div>
    );
  }

  if (!results || results.simulations.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">
            No simulation data available
          </p>
        </div>
      </div>
    );
  }

  const bins = createHistogramBins(results);

  if (bins.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        Ending Portfolio Distribution
      </h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="label"
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              label={{
                value: 'Simulations',
                angle: -90,
                position: 'insideLeft',
                fill: '#9ca3af',
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value, name, props) => {
                const bin = (props as { payload: HistogramBin }).payload;
                return [
                  `${value} simulations (${bin.percentage.toFixed(1)}%)`,
                  bin.isFailed ? 'Failed' : bin.range,
                ];
              }}
              labelFormatter={() => ''}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {bins.map((bin, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={bin.isFailed ? '#ef4444' : '#10b981'}
                  fillOpacity={bin.isFailed ? 0.8 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded" />
          <span className="text-gray-600 dark:text-gray-400">
            Successful: {results.successfulSimulations}
          </span>
        </div>
        {results.failedSimulations > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded" />
            <span className="text-gray-600 dark:text-gray-400">
              Failed: {results.failedSimulations}
            </span>
          </div>
        )}
        <div className="text-gray-500 dark:text-gray-400">
          Median: {formatCurrency(results.medianFinalPortfolio)}
        </div>
      </div>
    </div>
  );
}
