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
import { PageIntro } from '@/components/ui/PageIntro';
import { SkeletonRows } from '@/components/ui/Notice';
import { formatGBP, MONTH_NAMES } from '@/lib/format';
import { readableGBP } from './readable';

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
      <div className="grid gap-8" aria-busy="true">
        <SkeletonRows rows={2} />
        <div className="grid gap-8 md:grid-cols-2">
          <SkeletonRows rows={6} />
          <SkeletonRows rows={6} />
        </div>
        <SkeletonRows rows={8} />
      </div>
    );
  }

  const reached = results.percentOfTarget >= 100;
  const monthsAway = (results.targetRetireDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375);
  const dateKnown = Number.isFinite(results.targetRetireDate.getTime()) && monthsAway < 12 * 80;
  const ageThen = inputs.currentAge + Math.max(0, monthsAway) / 12;

  return (
    <div className="grid gap-8">
      <PageIntro>
        <p>
          You have <strong className="fig">{readableGBP(inputs.currentSavings)}</strong> towards a{' '}
          <strong className="fig">{readableGBP(results.amountNeeded)}</strong> target (
          <strong className="fig">{Math.round(results.percentOfTarget)}%</strong>), enough to spend{' '}
          {formatGBP(inputs.fireSpend)} a year at a {inputs.swr}% withdrawal rate.{' '}
          {reached ? (
            <>You&apos;ve already reached it.</>
          ) : dateKnown ? (
            <>
              Saving <span className="fig">{formatGBP(inputs.monthlySavings)}</span> a month at {inputs.expectedReturn}% growth, you&apos;d
              get there around <strong>{MONTH_NAMES[results.targetRetireDate.getMonth()]} {results.targetRetireDate.getFullYear()}</strong>, at
              about {Math.floor(ageThen)}.
            </>
          ) : (
            <>At the current savings and growth you wouldn&apos;t reach it; try a higher saving or return below.</>
          )}
        </p>
      </PageIntro>

      <p className="-mt-4 text-[12.5px] text-ink-3">
        Figures below are for exploring: changes here aren&apos;t saved. Set the defaults on the Settings tab.
      </p>

      <div className="grid gap-8 md:grid-cols-2">
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
