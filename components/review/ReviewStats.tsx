'use client';

import { AlertCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

interface ReviewStatsProps {
  total: number;
  uncategorised: number;
  flagged: number;
  isLoading?: boolean;
}

export function ReviewStats({
  total,
  uncategorised,
  flagged,
  isLoading = false,
}: ReviewStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total to Review',
      value: total,
      icon: AlertCircle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Uncategorised',
      value: uncategorised,
      icon: HelpCircle,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Flagged for Review',
      value: flagged,
      icon: CheckCircle2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`${stat.bgColor} rounded-lg p-4 shadow-sm`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value.toLocaleString()}
              </p>
            </div>
            <stat.icon className={`h-8 w-8 ${stat.color}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
