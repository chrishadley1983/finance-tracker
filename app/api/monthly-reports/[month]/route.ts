import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/api/require-user';

export const dynamic = 'force-dynamic';

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * GET /api/monthly-reports/YYYY-MM
 *
 * One saved report: its stored point-in-time HTML plus when it was generated.
 * → { year, month, generatedAt, reportData, html }   (404 when none is saved)
 *
 * Requires an authenticated session — exposes saved financial summaries.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const unauthorized = await requireUser();
  if (unauthorized) return unauthorized;

  const { month: raw } = await params;
  const m = MONTH.exec(raw ?? '');
  if (!m) return NextResponse.json({ error: 'Use a month like 2026-09.' }, { status: 400 });
  const year = Number(m[1]);
  const month = Number(m[2]);

  try {
    // monthly_reports isn't in the generated types.
    const { data, error } = await (supabaseAdmin as any)
      .from('monthly_reports')
      .select('year, month, report_data, report_html, generated_at')
      .eq('year', year)
      .eq('month', month)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return NextResponse.json({ error: 'No saved report for this month.' }, { status: 404 });
    return NextResponse.json(
      {
        year,
        month,
        generatedAt: row.generated_at ?? null,
        reportData: row.report_data ?? null,
        html: row.report_html ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/monthly-reports/[month] error:', error);
    return NextResponse.json({ error: 'Failed to load the saved report' }, { status: 500 });
  }
}
