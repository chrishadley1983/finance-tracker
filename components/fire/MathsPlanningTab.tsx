'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CurrentPositionCard,
  TargetCalculationCard,
  ScenarioComparisonCard,
  CoastAnalysisCard,
} from './maths';
import {
  calculateMathsPlanning,
  calculateAgeFromDateOfBirth,
  DEFAULT_NORMAL_FIRE_SPEND,
  DEFAULT_FAT_FIRE_SPEND,
  type MathsPlanningInputs,
} from '@/lib/fire/maths-calculator';
import type { FireInputs, NetWorthSummary } from '@/lib/types/fire';

interface MathsPlanningTabProps {
  fireInputs: FireInputs | null;
  netWorth: NetWorthSummary | null;
  isLoading: boolean;
}

export function MathsPlanningTab({
  fireInputs,
  netWorth,
  isLoading,
}: MathsPlanningTabProps) {
  // Extract savings (excluding property) from net worth
  const getSavingsFromNetWorth = (nw: NetWorthSummary | null): number => {
    if (!nw?.byType) return 0;
    return nw.byType
      .filter(t => ['investment', 'isa', 'pension', 'savings'].includes(t.type))
      .reduce((sum, t) => sum + t.total, 0);
  };

  // Extract property value from net worth
  const getPropertyFromNetWorth = (nw: NetWorthSummary | null): number => {
    if (!nw?.byType) return 0;
    return nw.byType.find(t => t.type === 'property')?.total || 0;
  };

  // Initialize state from app data
  const [inputs, setInputs] = useState<MathsPlanningInputs>({
    currentAge: 42,
    dateOfBirth: null,
    currentSavings: 0,
    propertyValue: 0,
    fireSpend: DEFAULT_NORMAL_FIRE_SPEND,
    swr: 3.5,
    expectedReturn: 3,
    monthlySavings: 0,
    coastTargetAge: 55,
    normalFireSpend: DEFAULT_NORMAL_FIRE_SPEND,
    fatFireSpend: DEFAULT_FAT_FIRE_SPEND,
    coastCurrentSpend: DEFAULT_NORMAL_FIRE_SPEND,
    coastMonthlySavings: 0,
    partnerSavings: 0,
    myPension: 0,
    jointSavings: 0,
  });

  // Update from API data when available
  useEffect(() => {
    if (fireInputs || netWorth) {
      // Calculate age from date of birth if available
      const exactAge = calculateAgeFromDateOfBirth(fireInputs?.dateOfBirth ?? null);

      setInputs(prev => ({
        ...prev,
        currentAge: exactAge ?? fireInputs?.currentAge ?? prev.currentAge,
        dateOfBirth: fireInputs?.dateOfBirth ?? null,
        currentSavings: getSavingsFromNetWorth(netWorth),
        propertyValue: getPropertyFromNetWorth(netWorth),
        swr: fireInputs?.withdrawalRate ?? prev.swr,
        expectedReturn: fireInputs?.expectedReturn ?? prev.expectedReturn,
        monthlySavings: (fireInputs?.annualSavings ?? 0) / 12,
        coastTargetAge: fireInputs?.targetRetirementAge ?? prev.coastTargetAge,
        fireSpend: fireInputs?.normalFireSpend ?? DEFAULT_NORMAL_FIRE_SPEND,
        normalFireSpend: fireInputs?.normalFireSpend ?? DEFAULT_NORMAL_FIRE_SPEND,
        fatFireSpend: fireInputs?.fatFireSpend ?? DEFAULT_FAT_FIRE_SPEND,
        coastCurrentSpend: fireInputs?.normalFireSpend ?? DEFAULT_NORMAL_FIRE_SPEND,
        coastMonthlySavings: (fireInputs?.annualSavings ?? 0) / 12,
      }));
    }
  }, [fireInputs, netWorth]);

  // Calculate results whenever inputs change
  const results = useMemo(() => {
    return calculateMathsPlanning(inputs);
  }, [inputs]);

  // Input change handlers
  const updateInput = <K extends keyof MathsPlanningInputs>(
    key: K,
    value: MathsPlanningInputs[K]
  ) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Current Position + Target Calculation */}
      <div className="grid md:grid-cols-2 gap-6">
        <CurrentPositionCard
          currentAge={inputs.currentAge}
          dateOfBirth={inputs.dateOfBirth}
          currentSavings={inputs.currentSavings}
          propertyValue={inputs.propertyValue}
          expectedReturn={inputs.expectedReturn}
          swr={inputs.swr}
          onExpectedReturnChange={(v) => updateInput('expectedReturn', v)}
          onSwrChange={(v) => updateInput('swr', v)}
        />
        <TargetCalculationCard
          fireSpend={inputs.fireSpend}
          swr={inputs.swr}
          amountNeeded={results.amountNeeded}
          percentOfTarget={results.percentOfTarget}
          targetRetireDate={results.targetRetireDate}
          onFireSpendChange={(v) => updateInput('fireSpend', v)}
        />
      </div>

      {/* Row 2: Scenario Comparison (Normal vs FAT) */}
      <ScenarioComparisonCard
        normal={results.normal}
        fat={results.fat}
        normalFireSpend={inputs.normalFireSpend}
        fatFireSpend={inputs.fatFireSpend}
        monthlySavings={inputs.monthlySavings}
        onNormalFireSpendChange={(v) => updateInput('normalFireSpend', v)}
        onFatFireSpendChange={(v) => updateInput('fatFireSpend', v)}
        onMonthlySavingsChange={(v) => updateInput('monthlySavings', v)}
      />

      {/* Row 3: Coast FI Analysis */}
      <CoastAnalysisCard
        coastNow={results.coastNow}
        coastAfterMinFire={results.coastAfterMinFire}
        coastTargetAge={inputs.coastTargetAge}
        coastCurrentSpend={inputs.coastCurrentSpend}
        coastMonthlySavings={inputs.coastMonthlySavings}
        onCoastTargetAgeChange={(v) => updateInput('coastTargetAge', v)}
        onCoastCurrentSpendChange={(v) => updateInput('coastCurrentSpend', v)}
        onCoastMonthlySavingsChange={(v) => updateInput('coastMonthlySavings', v)}
      />
    </div>
  );
}
