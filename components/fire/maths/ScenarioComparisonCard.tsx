'use client';

import {
  formatCurrency,
  formatYears,
} from '@/lib/fire/maths-calculator';
import type { MathsPlanningScenarioResult } from '@/lib/types/fire';

interface ScenarioComparisonCardProps {
  normal: MathsPlanningScenarioResult;
  fat: MathsPlanningScenarioResult;
  normalFireSpend: number;
  fatFireSpend: number;
  monthlySavings: number;
  onNormalFireSpendChange: (value: number) => void;
  onFatFireSpendChange: (value: number) => void;
  onMonthlySavingsChange: (value: number) => void;
}

export function ScenarioComparisonCard({
  normal,
  fat,
  normalFireSpend,
  fatFireSpend,
  monthlySavings,
  onNormalFireSpendChange,
  onFatFireSpendChange,
  onMonthlySavingsChange,
}: ScenarioComparisonCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        FIRE Scenarios: Normal vs FAT
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 text-gray-500 dark:text-gray-400 font-medium">
                Metric
              </th>
              <th className="text-right py-2 px-4">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-gray-900 dark:text-white font-semibold">Normal</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">£</span>
                    <input
                      type="number"
                      value={normalFireSpend}
                      onChange={(e) => onNormalFireSpendChange(parseFloat(e.target.value) || 0)}
                      className="w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right
                                 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      step="1000"
                    />
                  </div>
                </div>
              </th>
              <th className="text-right py-2 pl-4">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-gray-900 dark:text-white font-semibold">FAT</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">£</span>
                    <input
                      type="number"
                      value={fatFireSpend}
                      onChange={(e) => onFatFireSpendChange(parseFloat(e.target.value) || 0)}
                      className="w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right
                                 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                      step="1000"
                    />
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Target Amount
              </td>
              <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                {formatCurrency(normal.targetAmount)}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-gray-900 dark:text-white">
                {formatCurrency(fat.targetAmount)}
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Remaining to Fire
              </td>
              <td className="py-3 px-4 text-right font-medium text-orange-600 dark:text-orange-400">
                {formatCurrency(normal.remaining)}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-orange-600 dark:text-orange-400">
                {formatCurrency(fat.remaining)}
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Investment Income (Annual)
              </td>
              <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                {formatCurrency(normal.investmentIncome)}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-gray-900 dark:text-white">
                {formatCurrency(fat.investmentIncome)}
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Compounding Period
              </td>
              <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                {formatYears(normal.compoundingPeriod)}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-gray-900 dark:text-white">
                {formatYears(fat.compoundingPeriod)}
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Months to Save
              </td>
              <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                {normal.monthsToSave.toFixed(1)}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-gray-900 dark:text-white">
                {fat.monthsToSave.toFixed(1)}
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Years to Save
              </td>
              <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                {formatYears(normal.yearsToSave)}
              </td>
              <td className="py-3 pl-4 text-right font-medium text-gray-900 dark:text-white">
                {formatYears(fat.yearsToSave)}
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                Target Age
              </td>
              <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">
                {normal.targetAge.toFixed(1)}
              </td>
              <td className="py-3 pl-4 text-right font-semibold text-green-600 dark:text-green-400">
                {fat.targetAge.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Monthly Savings Input */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Monthly Savings
        </label>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            £
          </span>
          <input
            type="number"
            value={monthlySavings}
            onChange={(e) => onMonthlySavingsChange(parseFloat(e.target.value) || 0)}
            className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            step="100"
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Annual: {formatCurrency(monthlySavings * 12)}
        </p>
      </div>
    </div>
  );
}
