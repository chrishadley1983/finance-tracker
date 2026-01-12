'use client';

import { formatCurrency, formatPercent } from '@/lib/fire/maths-calculator';
import type { MathsPlanningCoastResult } from '@/lib/types/fire';

interface CoastAnalysisCardProps {
  coastNow: MathsPlanningCoastResult;
  coastAfterMinFire: MathsPlanningCoastResult;
  coastTargetAge: number;
  coastCurrentSpend: number;
  coastMonthlySavings: number;
  onCoastTargetAgeChange: (value: number) => void;
  onCoastCurrentSpendChange: (value: number) => void;
  onCoastMonthlySavingsChange: (value: number) => void;
}

function CoastCard({
  title,
  result,
  highlighted,
  coastCurrentSpend,
  coastMonthlySavings,
  onCoastCurrentSpendChange,
  onCoastMonthlySavingsChange,
  showEditableInputs,
}: {
  title: string;
  result: MathsPlanningCoastResult;
  highlighted?: boolean;
  coastCurrentSpend?: number;
  coastMonthlySavings?: number;
  onCoastCurrentSpendChange?: (value: number) => void;
  onCoastMonthlySavingsChange?: (value: number) => void;
  showEditableInputs?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${
      highlighted
        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
        : 'bg-gray-50 dark:bg-gray-700/50'
    }`}>
      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
        {title}
      </h4>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Retire Age</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {result.retireAge}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400">Current Spend</span>
          {showEditableInputs && onCoastCurrentSpendChange ? (
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">£</span>
              <input
                type="number"
                value={coastCurrentSpend}
                onChange={(e) => onCoastCurrentSpendChange(parseFloat(e.target.value) || 0)}
                className="w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right
                           focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                step="1000"
              />
            </div>
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(result.currentSpend)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400">Saving/month</span>
          {showEditableInputs && onCoastMonthlySavingsChange ? (
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">£</span>
              <input
                type="number"
                value={coastMonthlySavings}
                onChange={(e) => onCoastMonthlySavingsChange(parseFloat(e.target.value) || 0)}
                className="w-24 pl-5 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-right
                           focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                step="100"
              />
            </div>
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">
              {formatCurrency(result.savingPerMonth)}
            </span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Earnings req.</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(result.postTaxEarningsRequired)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Portfolio at {result.retireAge}</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(result.portfolioAtCoastAge)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">SWR</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatPercent(result.swr)}
          </span>
        </div>

        {/* Highlighted result */}
        <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              FIRE Spend @ {result.retireAge}
            </span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(result.fireSpendAtCoastAge)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoastAnalysisCard({
  coastNow,
  coastAfterMinFire,
  coastTargetAge,
  coastCurrentSpend,
  coastMonthlySavings,
  onCoastTargetAgeChange,
  onCoastCurrentSpendChange,
  onCoastMonthlySavingsChange,
}: CoastAnalysisCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Coast FI Analysis
        </h3>

        {/* Coast Target Age Input */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Retire Age:
          </label>
          <input
            type="number"
            value={coastTargetAge}
            onChange={(e) => onCoastTargetAgeChange(parseInt(e.target.value) || 50)}
            className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="40"
            max="70"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <CoastCard
          title="Coast Now"
          result={coastNow}
          coastCurrentSpend={coastCurrentSpend}
          coastMonthlySavings={coastMonthlySavings}
          onCoastCurrentSpendChange={onCoastCurrentSpendChange}
          onCoastMonthlySavingsChange={onCoastMonthlySavingsChange}
          showEditableInputs={true}
        />
        <CoastCard
          title="Coast After Target FIRE"
          result={coastAfterMinFire}
          highlighted
          coastCurrentSpend={coastCurrentSpend}
          coastMonthlySavings={coastMonthlySavings}
          onCoastCurrentSpendChange={onCoastCurrentSpendChange}
          onCoastMonthlySavingsChange={onCoastMonthlySavingsChange}
          showEditableInputs={true}
        />
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        &quot;Coast Now&quot; projects from today with the specified savings rate.
        &quot;Coast After Target FIRE&quot; saves at main rate until Target FIRE date, then at the coast savings rate.
      </p>
    </div>
  );
}
