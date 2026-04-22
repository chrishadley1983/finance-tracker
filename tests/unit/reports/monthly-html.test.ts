import { describe, it, expect } from 'vitest';
import { generateMonthlyReportHtml } from '@/lib/reports/monthly-html';
import type { MonthlyReportData } from '@/lib/reports/types';

function makeReport(overrides: Partial<MonthlyReportData> = {}): MonthlyReportData {
  return {
    year: 2026,
    month: 2,
    monthName: 'February',
    generatedAt: '2026-03-01T10:00:00Z',
    netWorth: 500_000,
    netWorthChange: 10_000,
    netWorthChangePct: 2.04,
    income: 6_000,
    expenses: 3_500,
    savingsRate: 41.7,
    wealthBreakdown: [
      { type: 'pension', label: 'Pensions', total: 200_000 },
      { type: 'isa', label: 'ISAs', total: 150_000 },
      { type: 'property', label: 'Property', total: 100_000 },
      { type: 'savings', label: 'Savings', total: 50_000 },
    ],
    netWorthHistory: [
      { date: '2025-06-01', total: 450_000 },
      { date: '2025-09-01', total: 470_000 },
      { date: '2025-12-01', total: 490_000 },
      { date: '2026-02-01', total: 500_000 },
    ],
    budgetComparisons: [
      { categoryName: 'Groceries', groupName: 'Essential', budget: 400, actual: 700, variance: -300, variancePct: -75 },
      { categoryName: 'Eating Out', groupName: 'Discretionary', budget: 200, actual: 150, variance: 50, variancePct: 25 },
    ],
    monthlyTrend: [
      { month: '2025-12', monthLabel: 'Dec', income: 5_500, expenses: 3_200 },
      { month: '2026-01', monthLabel: 'Jan', income: 5_800, expenses: 3_400 },
      { month: '2026-02', monthLabel: 'Feb', income: 6_000, expenses: 3_500 },
    ],
    firePortfolio: 300_000,
    fireScenarios: [
      { name: 'Lean', annualSpend: 32_000, withdrawalRate: 4, targetAmount: 800_000, currentAmount: 300_000, progressPct: 37.5 },
      { name: 'Full', annualSpend: 48_000, withdrawalRate: 4, targetAmount: 1_200_000, currentAmount: 300_000, progressPct: 25 },
    ],
    priorMonth: {
      netWorth: 490_000,
      income: 5_800,
      expenses: 3_400,
      savingsRate: 41.4,
      overBudgetCount: 3,
    },
    takeaways: [
      { tag: 'over budget', title: 'Groceries 1.8× budget', body: '£700 vs £400 budget.' },
      { tag: 'strong', title: 'Net worth growing', body: 'Up 2% month-on-month.' },
    ],
    ideas: [
      { tag: 'budget', title: 'Reset 1 budget line', body: 'Groceries has been over budget.' },
    ],
    ...overrides,
  };
}

describe('generateMonthlyReportHtml', () => {
  it('returns valid HTML document', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes title with month and year', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('February 2026');
    expect(html).toContain('Monthly Financial Report');
  });

  it('includes Chart.js CDN script', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('chart.js@4.4.1');
  });

  it('renders metric cards', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('Net Worth');
    expect(html).toContain('Income');
    expect(html).toContain('Spending');
    expect(html).toContain('Savings Rate');
    expect(html).toContain('41.7%');
  });

  it('renders wealth breakdown labels', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('Pensions');
    expect(html).toContain('ISAs');
    expect(html).toContain('Property');
  });

  it('renders FIRE progress bars', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('FIRE Progress');
    expect(html).toContain('Lean');
    expect(html).toContain('Full');
    expect(html).toContain('38%'); // 37.5 rounds to 38
  });

  it('renders takeaways with pill tags', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('over budget');
    expect(html).toContain('Groceries 1.8× budget');
    expect(html).toContain('Net worth growing');
  });

  it('renders ideas section', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('Ideas');
    expect(html).toContain('Reset 1 budget line');
  });

  it('renders over-budget table when categories are over', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('Over Budget Categories');
    expect(html).toContain('Groceries');
  });

  it('hides over-budget table when nothing is over', () => {
    const html = generateMonthlyReportHtml(makeReport({
      budgetComparisons: [
        { categoryName: 'Groceries', groupName: 'Essential', budget: 400, actual: 350, variance: 50, variancePct: 12.5 },
      ],
    }));
    expect(html).not.toContain('Over Budget Categories');
  });

  it('includes prior month deltas', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('vs');
    expect(html).toContain('last month');
  });

  it('handles no prior month gracefully', () => {
    const html = generateMonthlyReportHtml(makeReport({ priorMonth: null }));
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toContain('undefined');
  });

  it('includes print-optimised CSS', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('@media print');
    expect(html).toContain('break-inside: avoid');
  });

  it('includes dark mode CSS', () => {
    const html = generateMonthlyReportHtml(makeReport());
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('escapes HTML in category names in table cells', () => {
    const html = generateMonthlyReportHtml(makeReport({
      budgetComparisons: [
        { categoryName: '<script>alert("xss")</script>', groupName: 'Test', budget: 100, actual: 200, variance: -100, variancePct: -100 },
      ],
    }));
    // Table cells use esc() which converts to HTML entities
    expect(html).toContain('&lt;script&gt;');
  });
});
