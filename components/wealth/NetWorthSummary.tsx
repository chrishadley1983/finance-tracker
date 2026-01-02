'use client';

import { TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3 } from 'lucide-react';
import type { NetWorthSummary as NetWorthSummaryType } from '@/lib/types/fire';

interface NetWorthSummaryProps {
  data: NetWorthSummaryType | null;
  isLoading?: boolean;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  investment: <BarChart3 className="h-6 w-6" />,
  savings: <PiggyBank className="h-6 w-6" />,
  current: <Wallet className="h-6 w-6" />,
  pension: <BarChart3 className="h-6 w-6" />,
  isa: <PiggyBank className="h-6 w-6" />,
  property: <Wallet className="h-6 w-6" />,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function NetWorthSummary({ data, isLoading = false }: NetWorthSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  const isPositiveChange = data.change !== null && data.change >= 0;

  return (
    <div className="space-y-4 mb-6">
      {/* Main Total Card */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg p-6 shadow-lg text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm font-medium">Total Net Worth</p>
            <p className="text-4xl font-bold mt-1">{formatCurrency(data.total)}</p>
            {data.change !== null && (
              <div className="flex items-center mt-2 gap-2">
                {isPositiveChange ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-sm">
                  {isPositiveChange ? '+' : ''}
                  {formatCurrency(data.change)}
                  {data.changePercent !== null && (
                    <span className="ml-1 opacity-80">
                      ({isPositiveChange ? '+' : ''}
                      {data.changePercent.toFixed(1)}%)
                    </span>
                  )}
                </span>
                <span className="text-sm opacity-70">vs last month</span>
              </div>
            )}
          </div>
          <Wallet className="h-16 w-16 opacity-20" />
        </div>
      </div>

      {/* Type Breakdown Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data.byType.map((typeData) => (
          <div
            key={typeData.type}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              {TYPE_ICONS[typeData.type] || <Wallet className="h-5 w-5" />}
              <span className="text-sm font-medium">{typeData.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(typeData.total)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {data.total > 0
                ? `${((typeData.total / data.total) * 100).toFixed(1)}% of total`
                : '0%'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
