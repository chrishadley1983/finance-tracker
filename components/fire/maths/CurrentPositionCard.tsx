'use client';

import { formatCurrency, formatPercent } from '@/lib/fire/maths-calculator';

interface CurrentPositionCardProps {
  currentAge: number;
  dateOfBirth: string | null;
  currentSavings: number;
  propertyValue: number;
  expectedReturn: number;
  swr: number;
  onExpectedReturnChange: (value: number) => void;
  onSwrChange: (value: number) => void;
}

export function CurrentPositionCard({
  currentAge,
  dateOfBirth,
  currentSavings,
  propertyValue,
  expectedReturn,
  swr,
  onExpectedReturnChange,
  onSwrChange,
}: CurrentPositionCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Current Position
      </h3>

      <div className="space-y-4">
        {/* Read-only values */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              Age
            </label>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentAge.toFixed(2)}
            </p>
            {dateOfBirth && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                DOB: {new Date(dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
              Savings
            </label>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(currentSavings)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
            Property Value
          </label>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {formatCurrency(propertyValue)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Excluded from FIRE calculations
          </p>
        </div>

        {/* Editable sliders */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Real Return
              </label>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatPercent(expectedReturn)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={expectedReturn}
              onChange={(e) => onExpectedReturnChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0%</span>
              <span>12%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SWR
              </label>
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatPercent(swr)}
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="6"
              step="0.25"
              value={swr}
              onChange={(e) => onSwrChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>2%</span>
              <span>6%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
