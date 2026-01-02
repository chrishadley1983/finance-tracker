'use client';

import { Target, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import type { FireResult } from '@/lib/types/fire';

interface FireSummaryProps {
  result: FireResult | null;
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FireSummary({ result, isLoading = false }: FireSummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const currentAge = result.inputs.currentAge;
  const hasReachedCoastFi = result.coastFiAge !== null && result.coastFiAge <= currentAge;

  const stats = [
    {
      label: 'FI Number',
      value: formatCurrency(result.targetNumber),
      subtext: `${result.scenario.withdrawalRate}% withdrawal rate`,
      icon: Target,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Years to FI',
      value: result.yearsToFi !== null ? `${result.yearsToFi} years` : 'N/A',
      subtext: result.fiAge !== null ? `Age ${result.fiAge}` : 'Not achievable with current inputs',
      icon: Calendar,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: 'Coast FI',
      value: hasReachedCoastFi ? 'Reached!' : result.coastFiNumber ? formatCurrency(result.coastFiNumber) : 'N/A',
      subtext: hasReachedCoastFi
        ? 'You can stop saving now'
        : result.coastFiNumber
          ? 'Amount needed to coast'
          : 'Keep saving',
      icon: hasReachedCoastFi ? Sparkles : TrendingUp,
      color: hasReachedCoastFi ? 'text-amber-500' : 'text-purple-500',
      bgColor: hasReachedCoastFi ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: 'Success Rate',
      value: `${result.successRate.toFixed(0)}%`,
      subtext: 'Portfolio survival to age 100',
      icon: Target,
      color: result.successRate >= 90 ? 'text-emerald-500' : result.successRate >= 70 ? 'text-amber-500' : 'text-red-500',
      bgColor: result.successRate >= 90
        ? 'bg-emerald-50 dark:bg-emerald-900/20'
        : result.successRate >= 70
          ? 'bg-amber-50 dark:bg-amber-900/20'
          : 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        {result.scenario.name} Scenario
        {result.fiAge !== null && (
          <span className="ml-2 text-emerald-600 dark:text-emerald-400">
            — FI at age {result.fiAge}
          </span>
        )}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bgColor} rounded-lg p-4 shadow-sm`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stat.subtext}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
