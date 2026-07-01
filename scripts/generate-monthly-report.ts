/**
 * Generate (and save) a monthly finance report from the command line.
 *
 * Run:  npm run report:month -- 2026 6
 *       npm run report:month -- 2026 6 --html-out C:\temp\june.html
 */
import { loadEnvConfig } from '@next/env';
import { writeFileSync } from 'fs';

// Load .env.local exactly like Next does, BEFORE importing modules that read
// env at load time (supabaseAdmin). Hence the dynamic imports below.
loadEnvConfig(process.cwd(), true);

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const year = Number(args[0]);
  const month = Number(args[1]);
  if (!year || !month || month < 1 || month > 12) {
    console.error('Usage: npm run report:month -- <year> <month> [--html-out <path>]');
    process.exit(1);
  }

  const htmlOutIdx = process.argv.indexOf('--html-out');
  const htmlOut = htmlOutIdx > -1 ? process.argv[htmlOutIdx + 1] : null;

  const { aggregateMonthlyReport, saveMonthlyReport } = await import('@/lib/reports/aggregate');
  const { generateMonthlyReportHtml } = await import('@/lib/reports/monthly-html');

  console.log(`[${new Date().toISOString()}] Generating ${year}-${String(month).padStart(2, '0')} report…`);
  const report = await aggregateMonthlyReport(year, month);
  const html = generateMonthlyReportHtml(report);
  await saveMonthlyReport(report, html);

  console.log(`  Net worth £${report.netWorth.toFixed(0)} (${report.netWorthChange >= 0 ? '+' : ''}£${report.netWorthChange.toFixed(0)})`);
  console.log(`  Income £${report.income.toFixed(2)} | Expenses £${report.expenses.toFixed(2)} | Savings rate ${report.savingsRate.toFixed(1)}%`);
  if (report.holidayFire) {
    const hf = report.holidayFire;
    console.log(
      `  Holiday (net) £${hf.holidaySpend.toFixed(2)} (${hf.holidayPctOfExpenses.toFixed(1)}% of spend) | ` +
        `ex-holiday rate ${hf.savingsRateExHoliday.toFixed(1)}%`,
    );
  }
  console.log(`  Saved to monthly_reports (${html.length} bytes of HTML).`);

  if (htmlOut) {
    writeFileSync(htmlOut, html, 'utf8');
    console.log(`  HTML written to ${htmlOut}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Report generation failed:', e);
    process.exit(1);
  });
