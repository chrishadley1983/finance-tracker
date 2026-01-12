'use client';

import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface SuccessRateCardProps {
  successRate: number;
  totalSimulations: number;
  successfulSimulations: number;
  failedSimulations: number;
  isLoading?: boolean;
}

function getSuccessRateColor(rate: number): {
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
} {
  if (rate >= 95) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: <CheckCircle className="h-8 w-8 text-emerald-500" />,
    };
  }
  if (rate >= 80) {
    return {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      icon: <CheckCircle className="h-8 w-8 text-green-500" />,
    };
  }
  if (rate >= 70) {
    return {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: <AlertTriangle className="h-8 w-8 text-yellow-500" />,
    };
  }
  return {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    icon: <XCircle className="h-8 w-8 text-red-500" />,
  };
}

function getSuccessRateLabel(rate: number): string {
  if (rate >= 95) return 'Excellent';
  if (rate >= 80) return 'Good';
  if (rate >= 70) return 'Moderate Risk';
  if (rate >= 50) return 'High Risk';
  return 'Very High Risk';
}

export function SuccessRateCard({
  successRate,
  totalSimulations,
  successfulSimulations,
  failedSimulations,
  isLoading = false,
}: SuccessRateCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm mb-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          </div>
          <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    );
  }

  const { bg, text, border, icon } = getSuccessRateColor(successRate);
  const label = getSuccessRateLabel(successRate);

  return (
    <div className={`rounded-lg p-6 shadow-sm mb-6 border ${bg} ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Historical Success Rate
          </h3>
          <div className={`text-5xl font-bold ${text}`}>
            {successRate.toFixed(1)}%
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {successfulSimulations} of {totalSimulations} historical periods survived
          </p>
          <p className={`text-sm font-medium mt-1 ${text}`}>
            {label}
          </p>
        </div>
        <div className="flex flex-col items-center">
          {icon}
          {failedSimulations > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              {failedSimulations} failed
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              successRate >= 95
                ? 'bg-emerald-500'
                : successRate >= 80
                ? 'bg-green-500'
                : successRate >= 70
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
