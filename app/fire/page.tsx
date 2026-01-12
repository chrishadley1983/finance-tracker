'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';
import {
  FireInputsForm,
  ScenarioCards,
  FireSummary,
  ProjectionChart,
  ProjectionTable,
} from '@/components/fire';
import type { FireInputs, FireResult } from '@/lib/types/fire';

export default function FirePage() {
  const [inputs, setInputs] = useState<FireInputs | null>(null);
  const [results, setResults] = useState<FireResult[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch inputs
      const inputsResponse = await fetch('/api/fire/inputs');
      if (inputsResponse.ok) {
        const inputsData = await inputsResponse.json();
        setInputs(inputsData.inputs);
      }

      // Fetch portfolio value from investments
      const netWorthResponse = await fetch('/api/wealth/net-worth');
      if (netWorthResponse.ok) {
        const netWorthData = await netWorthResponse.json();
        // Get investment-type total
        const investmentTotal = netWorthData.byType?.find(
          (t: { type: string; total: number }) => t.type === 'investment'
        )?.total || 0;
        setPortfolioValue(investmentTotal);
      }

      // Calculate projections
      const calcResponse = await fetch('/api/fire/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (calcResponse.ok) {
        const calcData = await calcResponse.json();
        setResults(calcData.results);
        setInputs(calcData.inputs);

        // Select default scenario or first one
        if (calcData.results.length > 0) {
          const defaultScenario = calcData.results.find(
            (r: FireResult) => r.scenario.isDefault
          );
          setSelectedScenarioId(
            defaultScenario?.scenario.id || calcData.results[0].scenario.id
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveInputs = async (newInputs: Partial<FireInputs>) => {
    try {
      const response = await fetch('/api/fire/inputs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInputs),
      });

      if (!response.ok) {
        throw new Error('Failed to save inputs');
      }

      // Recalculate projections
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const selectedResult = results.find(
    (r) => r.scenario.id === selectedScenarioId
  ) || null;

  return (
    <AppLayout title="FIRE Calculator">
      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Financial Independence, Retire Early projections
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <FireInputsForm
        inputs={inputs}
        portfolioValue={portfolioValue}
        onSave={handleSaveInputs}
        isLoading={isLoading}
      />

      <ScenarioCards
        results={results}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={setSelectedScenarioId}
        isLoading={isLoading}
      />

      {selectedResult && (
        <>
          <FireSummary result={selectedResult} isLoading={isLoading} />
          <ProjectionChart result={selectedResult} isLoading={isLoading} />
          <ProjectionTable result={selectedResult} isLoading={isLoading} />
        </>
      )}
    </AppLayout>
  );
}
