'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  SimulationConfigForm,
  SuccessRateCard,
  SimulationSummaryCards,
  HistoricalProjectionChart,
  EndingPortfolioHistogram,
  MathsPlanningTab,
  FireInputsForm,
} from '@/components/fire';
import type {
  SimulationConfig,
  HistoricalSimulationResults,
  FireInputs,
  NetWorthSummary,
} from '@/lib/types/fire';
import {
  calculateAgeFromDateOfBirth,
  calculatePortfolioAtAge,
} from '@/lib/fire/maths-calculator';

type FireTab = 'simulation' | 'maths-planning' | 'settings';

export default function FirePage() {
  const [activeTab, setActiveTab] = useState<FireTab>('simulation');
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [results, setResults] = useState<HistoricalSimulationResults | null>(null);
  const [fireInputs, setFireInputs] = useState<FireInputs | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data (fire inputs and portfolio value)
  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch fire inputs
      const inputsResponse = await fetch('/api/fire/inputs');
      if (inputsResponse.ok) {
        const inputsData = await inputsResponse.json();
        setFireInputs(inputsData.inputs);
      }

      // Fetch portfolio value from investments
      const netWorthResponse = await fetch('/api/wealth/net-worth');
      if (netWorthResponse.ok) {
        const netWorthData = await netWorthResponse.json();
        setNetWorth(netWorthData);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  }, []);

  // State for portfolio note
  const [portfolioNote, setPortfolioNote] = useState<string | undefined>(undefined);

  // Build default config from fire inputs and net worth
  useEffect(() => {
    if (fireInputs || netWorth) {
      // Get savings total (excluding property) for current portfolio
      const getSavingsFromNetWorth = (nw: NetWorthSummary | null): number => {
        if (!nw?.byType) return 0;
        return nw.byType
          .filter(t => ['investment', 'isa', 'pension', 'savings'].includes(t.type))
          .reduce((sum, t) => sum + t.total, 0);
      };

      const currentSavings = getSavingsFromNetWorth(netWorth);

      // Calculate current age from DOB
      const exactAge = calculateAgeFromDateOfBirth(fireInputs?.dateOfBirth ?? null);
      const currentAge = exactAge ?? fireInputs?.currentAge ?? 42;

      // Get target retirement age
      const retirementAge = fireInputs?.targetRetirementAge ?? 55;

      // Calculate expected return (from fire inputs or default)
      const expectedReturn = fireInputs?.expectedReturn ?? 3;

      // Calculate monthly savings
      const monthlySavings = (fireInputs?.annualSavings ?? 0) / 12;

      // Project current savings to retirement age
      const projectedPortfolio = calculatePortfolioAtAge(
        currentSavings,
        currentAge,
        retirementAge,
        monthlySavings,
        expectedReturn
      );

      // Format currency for note
      const formatCurrencyShort = (amount: number): string => {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amount);
      };

      // Build portfolio note explaining the projection
      const yearsToRetirement = retirementAge - currentAge;
      const note = yearsToRetirement > 0
        ? `Projected from ${formatCurrencyShort(currentSavings)} today (age ${Math.round(currentAge)}) with ${formatCurrencyShort(monthlySavings * 12)}/yr savings at ${expectedReturn}% real return`
        : `Current portfolio value at age ${Math.round(currentAge)}`;
      setPortfolioNote(note);

      // Get the Normal FIRE Spend for default withdrawal
      const normalFireSpend = fireInputs?.normalFireSpend ?? 55000;

      // Calculate initial withdrawal rate from spend amount
      const initialWithdrawalRate = projectedPortfolio > 0
        ? (normalFireSpend / projectedPortfolio) * 100
        : fireInputs?.withdrawalRate || 4;

      // Build default config - use fixed amount by default (Normal FIRE Spend)
      const defaultConfig: SimulationConfig = {
        retirementDuration: 30,
        stockAllocation: 75,
        bondAllocation: 25,
        withdrawalStrategy: 'constant_dollar',
        initialWithdrawalRate: initialWithdrawalRate,
        initialWithdrawalAmount: normalFireSpend, // Use Normal FIRE Spend
        initialPortfolio: projectedPortfolio,
        currentAge: retirementAge, // This is retirement age for simulation
        extraIncome: fireInputs?.includeStatePension
          ? [{
              name: 'State Pension',
              annualAmount: 11500,
              startAge: 67,
              adjustForInflation: true,
            }]
          : [],
      };

      setConfig(defaultConfig);
    }
  }, [fireInputs, netWorth]);

  // Run simulation when config changes
  const runSimulation = useCallback(async (simulationConfig: SimulationConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fire/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: simulationConfig,
          includeYearlyData: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run simulation');
      }

      const data = await response.json();
      setResults(data);
      setConfig(simulationConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Run simulation when config is first set
  useEffect(() => {
    if (config && !results) {
      runSimulation(config);
    }
  }, [config, results, runSimulation]);

  const handleConfigChange = (newConfig: SimulationConfig) => {
    runSimulation(newConfig);
  };

  // Save fire inputs and refresh data
  const handleSaveInputs = async (updatedInputs: Partial<FireInputs>) => {
    try {
      const response = await fetch('/api/fire/inputs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fireInputs,
          ...updatedInputs,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFireInputs(data.inputs);
        // Reset results to trigger recalculation with new inputs
        setResults(null);
        setConfig(null);
      }
    } catch (err) {
      console.error('Error saving inputs:', err);
    }
  };

  return (
    <AppLayout title="FIRE Calculator">
      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Financial Independence, Retire Early projections
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('simulation')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'simulation'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Historical Simulation
          </button>
          <button
            onClick={() => setActiveTab('maths-planning')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'maths-planning'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Maths Planning
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {activeTab === 'simulation' && (
        <>
          <SimulationConfigForm
            config={config}
            onConfigChange={handleConfigChange}
            isLoading={isLoading && !config}
            portfolioNote={portfolioNote}
            defaultSpendAmount={fireInputs?.normalFireSpend ?? 55000}
          />

          {results && (
            <>
              <SuccessRateCard
                successRate={results.successRate}
                totalSimulations={results.totalSimulations}
                successfulSimulations={results.successfulSimulations}
                failedSimulations={results.failedSimulations}
                isLoading={isLoading}
              />

              <SimulationSummaryCards
                results={results}
                isLoading={isLoading}
              />

              <HistoricalProjectionChart
                results={results}
                isLoading={isLoading}
              />

              <EndingPortfolioHistogram
                results={results}
                isLoading={isLoading}
              />
            </>
          )}

          {!results && !isLoading && !error && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 shadow-sm text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Configure your simulation parameters and click &quot;Run Simulation&quot; to see results.
              </p>
            </div>
          )}
        </>
      )}

      {activeTab === 'maths-planning' && (
        <MathsPlanningTab
          fireInputs={fireInputs}
          netWorth={netWorth}
          isLoading={isLoading && !fireInputs}
        />
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              FIRE Calculator Settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              These settings are used across both the Historical Simulation and Maths Planning tabs.
              Your date of birth is used to calculate your exact age for projections.
            </p>
            <FireInputsForm
              inputs={fireInputs}
              onSave={handleSaveInputs}
              isLoading={isLoading && !fireInputs}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
