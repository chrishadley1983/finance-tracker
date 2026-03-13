/**
 * Rule-based takeaway generation for monthly finance reports.
 *
 * Generates structured takeaways with pill tags per the
 * MONTHLY_REPORT_TAKEAWAYS.md framework. Each function checks
 * a specific condition and returns a takeaway if triggered.
 */

import type {
  MonthlyReportData,
  Takeaway,
  BudgetComparisonItem,
} from './types';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// =============================================================================
// Over Budget Detection
// =============================================================================

/**
 * Generate takeaways for categories >50% over budget.
 * Sorted by absolute overspend descending, capped at 3.
 */
export function detectOverBudget(comparisons: BudgetComparisonItem[]): Takeaway[] {
  const overBudget = comparisons
    .filter((c) => c.budget > 0 && c.actual > c.budget * 1.5)
    .sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))
    .slice(0, 3);

  return overBudget.map((c) => ({
    tag: 'over budget' as const,
    title: `${c.categoryName} ${(c.actual / c.budget).toFixed(1)}× budget`,
    body: `${formatCurrency(c.actual)} actual vs ${formatCurrency(c.budget)} budget (${formatCurrency(c.actual - c.budget)} over). ${
      c.actual > c.budget * 3
        ? 'The budget figure may need re-baselining — check if this is structural or a one-off.'
        : 'Review whether this is a recurring pattern or exceptional spend.'
    }`,
  }));
}

// =============================================================================
// Income Trend
// =============================================================================

/**
 * Generate takeaway if income is trending up or down.
 */
export function analyseIncomeTrend(data: MonthlyReportData): Takeaway | null {
  if (!data.priorMonth) return null;

  const incomeDelta = data.income - data.priorMonth.income;
  const incomeDeltaPct = data.priorMonth.income > 0
    ? (incomeDelta / data.priorMonth.income) * 100
    : 0;

  if (incomeDeltaPct > 10) {
    return {
      tag: 'strong',
      title: 'Income trending upward',
      body: `${formatCurrency(data.income)} in ${MONTH_NAMES[data.month]} vs ${formatCurrency(data.priorMonth.income)} last month (${formatPct(incomeDeltaPct)}).`,
    };
  }

  if (incomeDeltaPct < -20) {
    return {
      tag: 'watch',
      title: 'Income dropped significantly',
      body: `${formatCurrency(data.income)} in ${MONTH_NAMES[data.month]} vs ${formatCurrency(data.priorMonth.income)} last month (${formatPct(incomeDeltaPct)}). Check if this is seasonal or structural.`,
    };
  }

  return null;
}

// =============================================================================
// Net Worth Trend
// =============================================================================

/**
 * Generate takeaway based on net worth direction.
 */
export function analyseNetWorthTrend(data: MonthlyReportData): Takeaway | null {
  if (data.netWorthChangePct > 2) {
    return {
      tag: 'strong',
      title: 'Net worth growing',
      body: `Net worth reached ${formatCurrency(data.netWorth)}, up ${formatPct(data.netWorthChangePct)} month-on-month (${formatCurrency(data.netWorthChange)}).`,
    };
  }

  if (data.netWorthChangePct < -2) {
    return {
      tag: 'watch',
      title: 'Net worth dipped',
      body: `Net worth at ${formatCurrency(data.netWorth)}, down ${formatPct(data.netWorthChangePct)} (${formatCurrency(data.netWorthChange)}). Likely market-driven if spending is on track.`,
    };
  }

  return null;
}

// =============================================================================
// Savings Rate
// =============================================================================

/**
 * Generate takeaway based on savings rate.
 */
export function analyseSavingsRate(data: MonthlyReportData): Takeaway | null {
  if (data.savingsRate >= 30) {
    return {
      tag: 'strong',
      title: `Savings rate: ${data.savingsRate.toFixed(0)}%`,
      body: `Strong savings rate of ${data.savingsRate.toFixed(1)}% in ${MONTH_NAMES[data.month]}. ${
        data.priorMonth
          ? `Last month was ${data.priorMonth.savingsRate.toFixed(1)}%.`
          : ''
      }`,
    };
  }

  if (data.savingsRate < 10 && data.savingsRate >= 0) {
    return {
      tag: 'watch',
      title: `Low savings rate: ${data.savingsRate.toFixed(0)}%`,
      body: `Savings rate of ${data.savingsRate.toFixed(1)}% in ${MONTH_NAMES[data.month]}. Check if this is a high-spend month or a trend.`,
    };
  }

  return null;
}

// =============================================================================
// FIRE Progress
// =============================================================================

/**
 * Generate takeaway for FIRE milestones.
 */
export function analyseFireProgress(data: MonthlyReportData): Takeaway | null {
  const bestScenario = data.fireScenarios.find((s) => s.progressPct >= 100);
  if (bestScenario) {
    return {
      tag: 'strong',
      title: `${bestScenario.name} FIRE target reached`,
      body: `Your portfolio of ${formatCurrency(data.firePortfolio)} exceeds the ${bestScenario.name} target of ${formatCurrency(bestScenario.targetAmount)} (${bestScenario.progressPct.toFixed(0)}%).`,
    };
  }

  // Show progress towards closest target
  const closest = [...data.fireScenarios].sort(
    (a, b) => Math.abs(100 - a.progressPct) - Math.abs(100 - b.progressPct),
  )[0];

  if (closest && closest.progressPct >= 80) {
    return {
      tag: 'strong',
      title: `${closest.progressPct.toFixed(0)}% towards ${closest.name} FIRE`,
      body: `Portfolio at ${formatCurrency(data.firePortfolio)} vs target of ${formatCurrency(closest.targetAmount)}. ${formatCurrency(closest.targetAmount - data.firePortfolio)} remaining.`,
    };
  }

  return null;
}

// =============================================================================
// Budget Re-baselining Ideas
// =============================================================================

/**
 * Suggest budget re-baselining for chronically over-budget categories.
 */
export function suggestBudgetRebaseline(comparisons: BudgetComparisonItem[]): Takeaway[] {
  const chronic = comparisons
    .filter((c) => c.budget > 0 && c.actual > c.budget * 2)
    .slice(0, 3);

  if (chronic.length === 0) return [];

  const names = chronic.map((c) => `${c.categoryName} (→ ${formatCurrency(c.actual)})`).join(', ');

  return [{
    tag: 'budget',
    title: `Reset ${chronic.length} budget line${chronic.length > 1 ? 's' : ''}`,
    body: `${names} ${chronic.length > 1 ? 'have' : 'has'} been significantly over budget. Realistic budgets are more useful than aspirational ones — consider re-baselining to trailing 3-month averages.`,
  }];
}

// =============================================================================
// Seasonal Ideas
// =============================================================================

/**
 * Generate seasonal/forward-looking ideas based on the month.
 */
export function generateSeasonalIdeas(month: number, year: number): Takeaway[] {
  const ideas: Takeaway[] = [];

  if (month === 3 || month === 4) {
    ideas.push({
      tag: 'investment',
      title: 'New tax year ISA strategy',
      body: `April 6 opens a fresh £20k ISA allowance. Consider tilting contributions toward accessible S&S ISAs to build the bridge between early retirement and state pension age at 67.`,
    });
  }

  if (month === 1) {
    ideas.push({
      tag: 'idea',
      title: 'Annual insurance review',
      body: `January is renewal season. Check home, car, life, and income protection premiums. Switching can save hundreds per year.`,
    });
  }

  if (month === 9) {
    ideas.push({
      tag: 'idea',
      title: 'Back-to-school budget check',
      body: `September brings new term fees, uniforms, and club sign-ups. Check Clubs & Kids Activities budget against actual enrolments.`,
    });
  }

  return ideas.slice(0, 2);
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate all takeaways and ideas for a monthly report.
 *
 * Returns structured takeaways (4-6) and ideas (3-4) per the framework.
 */
export function generateTakeaways(data: MonthlyReportData): {
  takeaways: Takeaway[];
  ideas: Takeaway[];
} {
  const takeaways: Takeaway[] = [];
  const ideas: Takeaway[] = [];

  // Over-budget categories
  takeaways.push(...detectOverBudget(data.budgetComparisons));

  // Income trend
  const incomeTakeaway = analyseIncomeTrend(data);
  if (incomeTakeaway) takeaways.push(incomeTakeaway);

  // Net worth trend
  const nwTakeaway = analyseNetWorthTrend(data);
  if (nwTakeaway) takeaways.push(nwTakeaway);

  // Savings rate
  const srTakeaway = analyseSavingsRate(data);
  if (srTakeaway) takeaways.push(srTakeaway);

  // FIRE progress
  const fireTakeaway = analyseFireProgress(data);
  if (fireTakeaway) takeaways.push(fireTakeaway);

  // Cap takeaways at 6
  const finalTakeaways = takeaways.slice(0, 6);

  // Ideas
  ideas.push(...suggestBudgetRebaseline(data.budgetComparisons));
  ideas.push(...generateSeasonalIdeas(data.month, data.year));

  // Cap ideas at 4
  const finalIdeas = ideas.slice(0, 4);

  return { takeaways: finalTakeaways, ideas: finalIdeas };
}
