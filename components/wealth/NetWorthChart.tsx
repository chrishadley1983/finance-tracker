'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { NetWorthHistory } from '@/lib/types/fire';
import { ACCOUNT_TYPE_LABELS } from '@/lib/types/fire';

type Period = 'all' | '1y' | '2y' | '5y';

interface NetWorthChartProps {
  initialPeriod?: Period;
}

const TYPE_COLORS: Record<string, string> = {
  investment: '#10b981',
  pension: '#6366f1',
  isa: '#8b5cf6',
  savings: '#3b82f6',
  current: '#f59e0b',
  property: '#ef4444',
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function NetWorthChart({ initialPeriod = '2y' }: NetWorthChartProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<NetWorthHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/wealth/history?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.snapshots.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">
            No historical data available. Add wealth snapshots or investment valuations to see your net worth over time.
          </p>
        </div>
      </div>
    );
  }

  // Get unique account types from data
  const accountTypes = new Set<string>();
  for (const snapshot of data.snapshots) {
    for (const type of Object.keys(snapshot.byType)) {
      accountTypes.add(type);
    }
  }

  // Format data for recharts
  const chartData = data.snapshots.map((snapshot) => ({
    date: snapshot.date,
    formattedDate: formatDate(snapshot.date),
    total: snapshot.total,
    ...snapshot.byType,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Net Worth Over Time
        </h3>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {(['1y', '2y', '5y', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              } ${p !== '1y' ? 'border-l border-gray-200 dark:border-gray-700' : ''}`}
            >
              {p === 'all' ? 'All' : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="formattedDate"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
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
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                String(name) === 'total' ? 'Total' : ACCOUNT_TYPE_LABELS[String(name)] || String(name),
              ]}
              labelFormatter={(label) => String(label)}
            />
            <Legend
              formatter={(value) =>
                value === 'total' ? 'Total' : ACCOUNT_TYPE_LABELS[value] || value
              }
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              name="total"
            />
            {Array.from(accountTypes).map((type) => (
              <Line
                key={type}
                type="monotone"
                dataKey={type}
                stroke={TYPE_COLORS[type] || '#9ca3af'}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                name={type}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
