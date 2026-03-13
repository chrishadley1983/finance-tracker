import { describe, it, expect } from 'vitest';
import {
  detectOverBudget,
  analyseIncomeTrend,
  analyseNetWorthTrend,
  analyseSavingsRate,
  analyseFireProgress,
  suggestBudgetRebaseline,
  generateSeasonalIdeas,
  generateTakeaways,
} from '@/lib/reports/takeaways';
import type { MonthlyReportData, BudgetComparisonItem } from '@/lib/reports/types';

function makeReport(overrides: Partial<MonthlyReportData> = {}): MonthlyReportData {
  return {
    year: 2026,
    month: 2,
    monthName: 'February',
    generatedAt: new Date().toISOString(),
    netWorth: 500_000,
    netWorthChange: 10_000,
    netWorthChangePct: 2.5,
    income: 6_000,
    expenses: 3_500,
    savingsRate: 41.7,
    wealthBreakdown: [],
    netWorthHistory: [],
    budgetComparisons: [],
    monthlyTrend: [],
    firePortfolio: 300_000,
    fireScenarios: [],
    priorMonth: null,
    takeaways: [],
    ideas: [],
    ...overrides,
  };
}

function makeBudgetItem(overrides: Partial<BudgetComparisonItem> = {}): BudgetComparisonItem {
  return {
    categoryName: 'Groceries',
    groupName: 'Essential',
    budget: 400,
    actual: 700,
    variance: -300,
    variancePct: -75,
    ...overrides,
  };
}

// =============================================================================
// detectOverBudget
// =============================================================================

describe('detectOverBudget', () => {
  it('returns empty for no over-budget categories', () => {
    const items = [makeBudgetItem({ budget: 400, actual: 350 })];
    expect(detectOverBudget(items)).toEqual([]);
  });

  it('flags categories >50% over budget', () => {
    const items = [makeBudgetItem({ budget: 200, actual: 400 })]; // 2x
    const result = detectOverBudget(items);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('over budget');
    expect(result[0].title).toContain('2.0×');
  });

  it('caps at 3 takeaways', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeBudgetItem({ categoryName: `Cat${i}`, budget: 100, actual: 200 + i * 50 }),
    );
    expect(detectOverBudget(items)).toHaveLength(3);
  });

  it('ignores zero-budget categories', () => {
    const items = [makeBudgetItem({ budget: 0, actual: 500 })];
    expect(detectOverBudget(items)).toEqual([]);
  });

  it('suggests re-baselining for >3× over budget', () => {
    const items = [makeBudgetItem({ budget: 100, actual: 400 })]; // 4x
    const result = detectOverBudget(items);
    expect(result[0].body).toContain('re-baselining');
  });
});

// =============================================================================
// analyseIncomeTrend
// =============================================================================

describe('analyseIncomeTrend', () => {
  it('returns null without prior month', () => {
    expect(analyseIncomeTrend(makeReport())).toBeNull();
  });

  it('flags upward income trend >10%', () => {
    const result = analyseIncomeTrend(makeReport({
      income: 7_000,
      priorMonth: { netWorth: 490_000, income: 5_000, expenses: 3_000, savingsRate: 40, overBudgetCount: 0 },
    }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('strong');
  });

  it('flags significant income drop >20%', () => {
    const result = analyseIncomeTrend(makeReport({
      income: 3_500,
      priorMonth: { netWorth: 490_000, income: 5_000, expenses: 3_000, savingsRate: 40, overBudgetCount: 0 },
    }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('watch');
  });

  it('returns null for stable income', () => {
    const result = analyseIncomeTrend(makeReport({
      income: 5_200,
      priorMonth: { netWorth: 490_000, income: 5_000, expenses: 3_000, savingsRate: 40, overBudgetCount: 0 },
    }));
    expect(result).toBeNull();
  });
});

// =============================================================================
// analyseNetWorthTrend
// =============================================================================

describe('analyseNetWorthTrend', () => {
  it('flags strong growth >2%', () => {
    const result = analyseNetWorthTrend(makeReport({ netWorthChangePct: 3.5 }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('strong');
  });

  it('flags dip <-2%', () => {
    const result = analyseNetWorthTrend(makeReport({ netWorthChangePct: -3.0, netWorthChange: -15_000 }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('watch');
  });

  it('returns null for flat movement', () => {
    expect(analyseNetWorthTrend(makeReport({ netWorthChangePct: 0.5 }))).toBeNull();
  });
});

// =============================================================================
// analyseSavingsRate
// =============================================================================

describe('analyseSavingsRate', () => {
  it('flags strong savings rate ≥30%', () => {
    const result = analyseSavingsRate(makeReport({ savingsRate: 35 }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('strong');
  });

  it('flags low savings rate <10%', () => {
    const result = analyseSavingsRate(makeReport({ savingsRate: 5 }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('watch');
  });

  it('returns null for mid-range', () => {
    expect(analyseSavingsRate(makeReport({ savingsRate: 20 }))).toBeNull();
  });
});

// =============================================================================
// analyseFireProgress
// =============================================================================

describe('analyseFireProgress', () => {
  it('flags scenario target reached', () => {
    const result = analyseFireProgress(makeReport({
      firePortfolio: 1_000_000,
      fireScenarios: [{ name: 'Lean', targetAmount: 800_000, currentAmount: 1_000_000, progressPct: 125 }],
    }));
    expect(result).not.toBeNull();
    expect(result!.tag).toBe('strong');
    expect(result!.title).toContain('Lean');
    expect(result!.title).toContain('reached');
  });

  it('flags ≥80% progress towards closest target', () => {
    const result = analyseFireProgress(makeReport({
      firePortfolio: 850_000,
      fireScenarios: [{ name: 'Full', targetAmount: 1_000_000, currentAmount: 850_000, progressPct: 85 }],
    }));
    expect(result).not.toBeNull();
    expect(result!.title).toContain('85%');
  });

  it('returns null when far from target', () => {
    expect(analyseFireProgress(makeReport({
      firePortfolio: 200_000,
      fireScenarios: [{ name: 'Fat', targetAmount: 2_000_000, currentAmount: 200_000, progressPct: 10 }],
    }))).toBeNull();
  });
});

// =============================================================================
// suggestBudgetRebaseline
// =============================================================================

describe('suggestBudgetRebaseline', () => {
  it('suggests rebaseline for >2× over budget', () => {
    const items = [makeBudgetItem({ categoryName: 'Subscriptions', budget: 100, actual: 350 })];
    const result = suggestBudgetRebaseline(items);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('budget');
    expect(result[0].body).toContain('Subscriptions');
  });

  it('returns empty when nothing qualifies', () => {
    const items = [makeBudgetItem({ budget: 400, actual: 500 })]; // 1.25x
    expect(suggestBudgetRebaseline(items)).toEqual([]);
  });
});

// =============================================================================
// generateSeasonalIdeas
// =============================================================================

describe('generateSeasonalIdeas', () => {
  it('generates ISA idea in March/April', () => {
    const ideas = generateSeasonalIdeas(4, 2026);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0].title).toContain('ISA');
  });

  it('generates insurance idea in January', () => {
    const ideas = generateSeasonalIdeas(1, 2026);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas[0].title).toContain('insurance');
  });

  it('returns empty for months without seasonal triggers', () => {
    const ideas = generateSeasonalIdeas(6, 2026);
    expect(ideas).toEqual([]);
  });
});

// =============================================================================
// generateTakeaways (integration)
// =============================================================================

describe('generateTakeaways', () => {
  it('returns takeaways and ideas arrays', () => {
    const { takeaways, ideas } = generateTakeaways(makeReport());
    expect(Array.isArray(takeaways)).toBe(true);
    expect(Array.isArray(ideas)).toBe(true);
  });

  it('caps takeaways at 6', () => {
    const overBudgetItems = Array.from({ length: 10 }, (_, i) =>
      makeBudgetItem({ categoryName: `Cat${i}`, budget: 100, actual: 200 + i * 50 }),
    );
    const data = makeReport({
      budgetComparisons: overBudgetItems,
      netWorthChangePct: 5,
      savingsRate: 45,
    });
    const { takeaways } = generateTakeaways(data);
    expect(takeaways.length).toBeLessThanOrEqual(6);
  });

  it('caps ideas at 4', () => {
    const rebaselineItems = Array.from({ length: 5 }, (_, i) =>
      makeBudgetItem({ categoryName: `Cat${i}`, budget: 50, actual: 200 }),
    );
    const data = makeReport({ budgetComparisons: rebaselineItems, month: 3 });
    const { ideas } = generateTakeaways(data);
    expect(ideas.length).toBeLessThanOrEqual(4);
  });
});
