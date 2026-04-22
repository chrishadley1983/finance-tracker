/**
 * Fix the Feb 2026 report HTML by generating it from the original saved report_data.
 * Run with: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/fix-feb-report.ts
 */
import { createClient } from '@supabase/supabase-js';
import { generateMonthlyReportHtml } from '../lib/reports/monthly-html';
import type { MonthlyReportData } from '../lib/reports/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'finance' } },
);

const TYPE_LABELS: Record<string, string> = {
  current: 'Current Accounts',
  savings: 'Savings',
  isa: 'ISAs',
  isas: 'ISAs',
  pension: 'Pensions',
  pensions: 'Pensions',
  investment: 'Investments',
  investments: 'Investments',
  property: 'Property',
  credit: 'Credit',
  other: 'Other',
};

async function fix() {
  const { data } = await (supabase as any)
    .from('monthly_reports')
    .select('report_data, generated_at')
    .eq('year', 2026)
    .eq('month', 2)
    .single();

  if (!data) {
    console.error('No Feb 2026 report found');
    return;
  }

  const rd = data.report_data;
  const wb = rd.wealth_breakdown as Record<string, number>;

  // Reconstruct MonthlyReportData from saved summary
  const reportData: MonthlyReportData = {
    year: 2026,
    month: 2,
    monthName: 'February',
    generatedAt: data.generated_at || new Date().toISOString(),
    netWorth: rd.net_worth,
    netWorthChange: rd.net_worth_change,
    netWorthChangePct: rd.net_worth_change_pct,
    income: rd.income,
    expenses: rd.expenses,
    savingsRate: rd.savings_rate,
    wealthBreakdown: Object.entries(wb).map(([type, total]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      total,
    })),
    netWorthHistory: [], // Not available from summary — chart will be empty
    budgetComparisons: (rd.top_categories || []).map((c: any) => ({
      categoryName: c.name,
      groupName: '',
      budget: c.budget,
      actual: c.actual,
      variance: c.actual - c.budget,
      variancePct: c.budget > 0 ? ((c.actual - c.budget) / c.budget) * 100 : 0,
    })),
    monthlyTrend: [],
    // Original fire_portfolio was missing savings — recalculate ex-property
    firePortfolio: Object.entries(wb)
      .filter(([type]) => type !== 'property')
      .reduce((sum, [, val]) => sum + Number(val), 0),
    fireScenarios: [],
    priorMonth: null,
    takeaways: [],
    ideas: [],
  };

  // Fetch FIRE scenarios to build progress bars correctly
  const { data: scenarios } = await supabase
    .from('fire_scenarios')
    .select('*')
    .order('sort_order');

  if (scenarios) {
    reportData.fireScenarios = scenarios.map((s: any) => {
      const annualSpend = Number(s.annual_spend) || 0;
      const wr = Number(s.withdrawal_rate) || 4;
      const targetAmount = annualSpend / (wr / 100);
      return {
        name: s.name,
        annualSpend,
        withdrawalRate: wr,
        targetAmount,
        currentAmount: rd.fire_portfolio,
        progressPct: targetAmount > 0 ? (rd.fire_portfolio / targetAmount) * 100 : 0,
      };
    });
  }

  // Generate takeaways from the data
  const { generateTakeaways } = await import('../lib/reports/takeaways');
  const { takeaways, ideas } = generateTakeaways(reportData);
  reportData.takeaways = takeaways;
  reportData.ideas = ideas;

  const html = generateMonthlyReportHtml(reportData);

  const { error } = await (supabase as any)
    .from('monthly_reports')
    .update({ report_html: html })
    .eq('year', 2026)
    .eq('month', 2);

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log(`Updated Feb 2026 report HTML (${html.length} bytes)`);
    console.log(`Fire portfolio: £${rd.fire_portfolio.toLocaleString()}`);
  }
}

fix().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
