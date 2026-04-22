/**
 * One-off script to backfill report_html for existing monthly reports.
 * Run with: npx tsx scripts/backfill-report-html.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { aggregateMonthlyReport } from '../lib/reports/aggregate';
import { generateMonthlyReportHtml } from '../lib/reports/monthly-html';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'finance' } },
);

async function backfill() {
  // Get all reports without HTML
  const { data: reports } = await (supabase as any)
    .from('monthly_reports')
    .select('year, month')
    .is('report_html', null);

  if (!reports?.length) {
    console.log('No reports to backfill.');
    return;
  }

  for (const { year, month } of reports) {
    console.log(`Generating HTML for ${year}-${String(month).padStart(2, '0')}...`);
    const data = await aggregateMonthlyReport(year, month);
    const html = generateMonthlyReportHtml(data);

    const { error } = await (supabase as any)
      .from('monthly_reports')
      .update({ report_html: html })
      .eq('year', year)
      .eq('month', month);

    if (error) {
      console.error(`  Error: ${error.message}`);
    } else {
      console.log(`  Done (${html.length} bytes)`);
    }
  }
}

backfill().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
