/**
 * Regenerate stored monthly reports for 2026 so their saved report_data and
 * report_html pick up the sign-aware trend-chart fix. Runs the aggregation
 * directly with the service role (no HTTP), so it bypasses the auth-gated
 * API route.
 *
 *   npx tsx scripts/regen-2026-reports.ts
 *
 * Env (SUPABASE_SERVICE_ROLE_KEY etc.) is loaded from .env.local before the
 * Supabase client module is imported, hence the dynamic imports.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { aggregateMonthlyReport, saveMonthlyReport } = await import('../lib/reports/aggregate');
  const { generateMonthlyReportHtml } = await import('../lib/reports/monthly-html');

  const months = [1, 2, 3, 4, 5];
  for (const month of months) {
    const data = await aggregateMonthlyReport(2026, month);
    const html = generateMonthlyReportHtml(data);
    await saveMonthlyReport(data, html);
    const may = data.monthlyTrend.find((m) => m.month === '2026-05');
    console.log(
      `Regenerated 2026-${String(month).padStart(2, '0')}: ` +
        `income £${data.income.toFixed(2)}, expenses £${data.expenses.toFixed(2)}` +
        (may ? ` | trend[May] income £${may.income.toFixed(2)}, exp £${may.expenses.toFixed(2)}` : ''),
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
