/**
 * Generate End of January 2026 and End of February 2026 reports.
 * Jan must be generated first so Feb has prior month data.
 *
 * Run with: npx tsx scripts/gen-jan-feb-reports.ts
 */
import { aggregateMonthlyReport, saveMonthlyReport } from '../lib/reports/aggregate';
import { generateMonthlyReportHtml } from '../lib/reports/monthly-html';

async function main() {
  // --- January 2026 ---
  console.log('=== Generating January 2026 report ===');
  const janData = await aggregateMonthlyReport(2026, 1);
  const janHtml = generateMonthlyReportHtml(janData);
  await saveMonthlyReport(janData, janHtml);

  console.log('Jan Net Worth:', janData.netWorth.toLocaleString());
  console.log('Jan Income:', janData.income.toLocaleString());
  console.log('Jan Expenses:', janData.expenses.toLocaleString());
  console.log('Jan Savings Rate:', janData.savingsRate.toFixed(1) + '%');
  console.log('Jan FIRE Portfolio:', janData.firePortfolio.toLocaleString());
  console.log('Jan Wealth Breakdown:', janData.wealthBreakdown.map(w => `${w.label}: £${w.total.toLocaleString()}`).join(', '));
  console.log('Jan Budget Categories:', janData.budgetComparisons.length);
  console.log('Jan Net Worth History Points:', janData.netWorthHistory.length);
  console.log('Jan Monthly Trend Points:', janData.monthlyTrend.length);
  console.log('Jan Prior Month:', janData.priorMonth ? 'yes' : 'no');
  console.log('Jan FIRE Scenarios:', janData.fireScenarios.length);
  console.log('Jan Takeaways:', janData.takeaways.length);
  console.log('Jan HTML size:', janHtml.length);
  console.log('');

  // --- February 2026 ---
  console.log('=== Generating February 2026 report ===');
  const febData = await aggregateMonthlyReport(2026, 2);
  const febHtml = generateMonthlyReportHtml(febData);
  await saveMonthlyReport(febData, febHtml);

  console.log('Feb Net Worth:', febData.netWorth.toLocaleString());
  console.log('Feb Income:', febData.income.toLocaleString());
  console.log('Feb Expenses:', febData.expenses.toLocaleString());
  console.log('Feb Savings Rate:', febData.savingsRate.toFixed(1) + '%');
  console.log('Feb FIRE Portfolio:', febData.firePortfolio.toLocaleString());
  console.log('Feb Wealth Breakdown:', febData.wealthBreakdown.map(w => `${w.label}: £${w.total.toLocaleString()}`).join(', '));
  console.log('Feb Budget Categories:', febData.budgetComparisons.length);
  console.log('Feb Net Worth History Points:', febData.netWorthHistory.length);
  console.log('Feb Monthly Trend Points:', febData.monthlyTrend.length);
  console.log('Feb Prior Month:', febData.priorMonth ? 'yes' : 'no');
  if (febData.priorMonth) {
    console.log('  Prior NW:', febData.priorMonth.netWorth.toLocaleString());
    console.log('  Prior Income:', febData.priorMonth.income.toLocaleString());
    console.log('  Prior Expenses:', febData.priorMonth.expenses.toLocaleString());
  }
  console.log('Feb FIRE Scenarios:', febData.fireScenarios.length);
  console.log('Feb Takeaways:', febData.takeaways.length);
  console.log('Feb HTML size:', febHtml.length);

  // Budget summary
  const janBudgetTotal = janData.budgetComparisons.reduce((s, c) => s + c.budget, 0);
  const janActualTotal = janData.budgetComparisons.reduce((s, c) => s + c.actual, 0);
  const febBudgetTotal = febData.budgetComparisons.reduce((s, c) => s + c.budget, 0);
  const febActualTotal = febData.budgetComparisons.reduce((s, c) => s + c.actual, 0);
  console.log('\n=== Budget Summary ===');
  console.log(`Jan: Budget £${janBudgetTotal.toLocaleString()} | Actual £${janActualTotal.toLocaleString()} | Variance £${(janActualTotal - janBudgetTotal).toLocaleString()}`);
  console.log(`Feb: Budget £${febBudgetTotal.toLocaleString()} | Actual £${febActualTotal.toLocaleString()} | Variance £${(febActualTotal - febBudgetTotal).toLocaleString()}`);

  // Over budget
  const janOver = janData.budgetComparisons.filter(c => c.budget > 0 && c.actual > c.budget);
  const febOver = febData.budgetComparisons.filter(c => c.budget > 0 && c.actual > c.budget);
  console.log(`\nJan Over Budget (${janOver.length}):`);
  janOver.forEach(c => console.log(`  ${c.categoryName}: £${c.actual.toLocaleString()} vs £${c.budget.toLocaleString()} (+£${(c.actual - c.budget).toLocaleString()})`));
  console.log(`Feb Over Budget (${febOver.length}):`);
  febOver.forEach(c => console.log(`  ${c.categoryName}: £${c.actual.toLocaleString()} vs £${c.budget.toLocaleString()} (+£${(c.actual - c.budget).toLocaleString()})`));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
