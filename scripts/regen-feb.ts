import { aggregateMonthlyReport, saveMonthlyReport } from '../lib/reports/aggregate';
import { generateMonthlyReportHtml } from '../lib/reports/monthly-html';

async function main() {
  const data = await aggregateMonthlyReport(2026, 2);
  const html = generateMonthlyReportHtml(data);
  await saveMonthlyReport(data, html);

  console.log('Fire portfolio: £' + data.firePortfolio.toLocaleString());
  console.log('Net worth: £' + data.netWorth.toLocaleString());
  console.log('Net worth history points:', data.netWorthHistory.length);
  console.log('Monthly trend points:', data.monthlyTrend.length);
  console.log('Prior month:', data.priorMonth ? 'yes' : 'no');
  console.log('HTML size:', html.length);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
