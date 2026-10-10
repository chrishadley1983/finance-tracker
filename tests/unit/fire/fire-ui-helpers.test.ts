import { describe, it, expect, beforeEach } from 'vitest';
import { ernLedeParts, historicalSurvival, readableGBP, readablePct } from '@/components/fire/readable';
import { loadSimPrefs, saveSimPrefs, SIM_PREFS_KEY } from '@/components/fire/ern/sim-prefs';
import { DEFAULT_CONFIG } from '@/components/fire/ern/ErnDashboard';
import { readableDuration, shortDuration } from '@/components/fire/maths/ScenarioComparisonCard';
import { failureCellClass } from '@/components/fire/ern/ConditionalFailureTable';
import { cohortStartLabel } from '@/components/fire/ern/CapeScatterChart';

describe('readable numbers', () => {
  it('rounds money for reading', () => {
    expect(readableGBP(1_538_050)).toBe('£1.54m');
    expect(readableGBP(12_400_000)).toBe('£12.4m');
    expect(readableGBP(540_400)).toBe('£540k');
    expect(readableGBP(8_200)).toBe('£8,200');
    expect(readableGBP(-45_000)).toBe('-£45k');
  });

  it('rounds percentages for reading', () => {
    expect(readablePct(3.2456)).toBe('3.2%');
    expect(readablePct(94.4)).toBe('94%');
  });

  it('works out how many historical periods a rate survived', () => {
    expect(historicalSurvival([{ swr: 3 }, { swr: 4 }, { swr: 5 }, { swr: 2.5 }], 3.2)).toBe(50);
    expect(historicalSurvival([], 3)).toBeNull();
  });

  it('builds the ERN lede', () => {
    const p = ernLedeParts({
      annualSpend: 40000,
      portfolio: 1_250_000,
      personalWr: 3.2,
      ernDynamicWr: 3.0,
      horizonYears: 45,
      historicalSurvivalPct: 94.2,
      mcSurvivalRate: 91,
      mcPaths: 500,
      currentAge: 50,
      retirementAge: 50,
    });
    expect(p).toMatchObject({ spend: '£40k', pot: '£1.25m', wr: '3.2%', historical: '94%', mc: '91%', verdict: 'a little above', retiresLater: false });
  });

  it('formats durations', () => {
    expect(readableDuration(3.75)).toBe('3 years 9 months');
    expect(readableDuration(1)).toBe('1 year');
    expect(readableDuration(Infinity)).toBe('never at this rate');
    expect(shortDuration(3.75)).toBe('3y 9m');
  });

  it('colours failure cells by severity', () => {
    expect(failureCellClass(0)).toBe('text-ink-3');
    expect(failureCellClass(8)).toContain('warn');
    expect(failureCellClass(40)).toContain('bad');
  });

  it('labels cohort start months', () => {
    expect(cohortStartLabel(0)).toBe('Jan 1871');
    expect(cohortStartLabel(119)).toBe('Dec 1880');
  });
});

describe('simulation settings persistence', () => {
  beforeEach(() => localStorage.clear());

  it('keeps simulation knobs only, not inputs owned by FIRE settings or accounts', () => {
    saveSimPrefs({ ...DEFAULT_CONFIG, equityAllocation: 0.6, guardrailEnabled: true, horizonYears: 40, portfolio: 9, annualSpend: 1, currentAge: 30 });
    const stored = JSON.parse(localStorage.getItem(SIM_PREFS_KEY)!);
    expect(stored).toMatchObject({ equityAllocation: 0.6, guardrailEnabled: true, horizonYears: 40 });
    expect(stored).not.toHaveProperty('portfolio');
    expect(stored).not.toHaveProperty('annualSpend');
    expect(stored).not.toHaveProperty('currentAge');
    expect(loadSimPrefs()).toMatchObject({ equityAllocation: 0.6, guardrailEnabled: true });
  });

  it('ignores junk and blocked storage', () => {
    localStorage.setItem(SIM_PREFS_KEY, '{"equityAllocation":"lots","mcPaths":1000}');
    expect(loadSimPrefs()).toEqual({ mcPaths: 1000 });
    localStorage.setItem(SIM_PREFS_KEY, 'not json');
    expect(loadSimPrefs()).toEqual({});
  });
});
