'use client';

import { formatCurrency } from '@/lib/fire/maths-calculator';

interface PartnerContributionsCardProps {
  partnerSavings: number;
  myPension: number;
  jointSavings: number;
  currentSavings: number;
  totalHouseholdSavings: number;
  onPartnerSavingsChange: (value: number) => void;
  onMyPensionChange: (value: number) => void;
  onJointSavingsChange: (value: number) => void;
}

export function PartnerContributionsCard({
  partnerSavings,
  myPension,
  jointSavings,
  currentSavings,
  totalHouseholdSavings,
  onPartnerSavingsChange,
  onMyPensionChange,
  onJointSavingsChange,
}: PartnerContributionsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Partner Contributions
      </h3>

      <div className="space-y-4">
        {/* Partner Savings Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Partner Savings (Pension + Shares)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              £
            </span>
            <input
              type="number"
              value={partnerSavings}
              onChange={(e) => onPartnerSavingsChange(parseFloat(e.target.value) || 0)}
              className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="1000"
            />
          </div>
        </div>

        {/* My Pension Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            My Pension
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              £
            </span>
            <input
              type="number"
              value={myPension}
              onChange={(e) => onMyPensionChange(parseFloat(e.target.value) || 0)}
              className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="1000"
            />
          </div>
        </div>

        {/* Joint Savings Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Joint Savings
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              £
            </span>
            <input
              type="number"
              value={jointSavings}
              onChange={(e) => onJointSavingsChange(parseFloat(e.target.value) || 0)}
              className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="1000"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>My Savings (from app)</span>
              <span>{formatCurrency(currentSavings)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Partner Savings</span>
              <span>{formatCurrency(partnerSavings)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>My Pension</span>
              <span>{formatCurrency(myPension)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Joint Savings</span>
              <span>{formatCurrency(jointSavings)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Total Household
            </span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalHouseholdSavings)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
