'use client';

import { Check, Plus } from 'lucide-react';
import type { FireResult } from '@/lib/types/fire';

interface ScenarioCardsProps {
  results: FireResult[];
  selectedScenarioId: string | null;
  onSelectScenario: (scenarioId: string) => void;
  onAddScenario?: () => void;
  isLoading?: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount.toFixed(0)}`;
}

export function ScenarioCards({
  results,
  selectedScenarioId,
  onSelectScenario,
  onAddScenario,
  isLoading = false,
}: ScenarioCardsProps) {
  if (isLoading) {
    return (
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Scenarios</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm animate-pulse"
            >
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Scenarios</h3>
        <p className="text-gray-500 dark:text-gray-400">No scenarios available</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Scenarios</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {results.map((result) => {
          const isSelected = selectedScenarioId === result.scenario.id;
          const scenario = result.scenario;

          return (
            <button
              key={scenario.id}
              onClick={() => onSelectScenario(scenario.id)}
              className={`relative text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
              )}

              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                {scenario.name}
              </h4>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {formatCurrency(scenario.annualSpend)}/yr
              </p>

              {result.fiAge !== null ? (
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  FI @ {result.fiAge}
                </p>
              ) : (
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  FI: N/A
                </p>
              )}

              {scenario.isDefault && (
                <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                  Default
                </span>
              )}
            </button>
          );
        })}

        {onAddScenario && (
          <button
            onClick={onAddScenario}
            className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
          >
            <Plus className="h-6 w-6 mb-1" />
            <span className="text-sm font-medium">Add Custom</span>
          </button>
        )}
      </div>
    </div>
  );
}
