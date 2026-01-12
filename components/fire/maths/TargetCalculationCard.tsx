'use client';

import { formatCurrency, formatPercent, formatDate } from '@/lib/fire/maths-calculator';

interface TargetCalculationCardProps {
  fireSpend: number;
  swr: number;
  amountNeeded: number;
  percentOfTarget: number;
  targetRetireDate: Date;
  onFireSpendChange: (value: number) => void;
}

export function TargetCalculationCard({
  fireSpend,
  swr,
  amountNeeded,
  percentOfTarget,
  targetRetireDate,
  onFireSpendChange,
}: TargetCalculationCardProps) {
  const progressCapped = Math.min(percentOfTarget, 100);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Target Calculation
      </h3>

      <div className="space-y-4">
        {/* Fire Spend Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            FIRE Spend (Annual)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              £
            </span>
            <input
              type="number"
              value={fireSpend}
              onChange={(e) => onFireSpendChange(parseFloat(e.target.value) || 0)}
              className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="1000"
            />
          </div>
        </div>

        {/* Calculated Values */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              SWR
            </label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatPercent(swr)}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              Amount Needed
            </label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatCurrency(amountNeeded)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              Progress
            </label>
            <span className={`text-sm font-bold ${
              percentOfTarget >= 100
                ? 'text-green-600 dark:text-green-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}>
              {formatPercent(percentOfTarget, 1)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-300 ${
                percentOfTarget >= 100
                  ? 'bg-green-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${progressCapped}%` }}
            />
          </div>
        </div>

        {/* Target Date */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
            Target Retire Date
          </label>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {percentOfTarget >= 100 ? 'Already achieved!' : formatDate(targetRetireDate)}
          </p>
        </div>
      </div>
    </div>
  );
}
