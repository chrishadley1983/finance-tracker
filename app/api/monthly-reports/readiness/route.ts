import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrUser } from '@/lib/api/require-agent';
import { getMonthReadiness, previousMonthUk } from '@/lib/reports/readiness';

export const dynamic = 'force-dynamic';

/**
 * GET /api/monthly-reports/readiness?year=YYYY&month=M
 * (defaults to the previous month, UK time)
 * Auth: x-api-key = FINANCE_AGENT_KEY (Peter) or a logged-in session.
 *
 * → { year, month, monthLabel, ready, checks: [{ key, ok, detail, missing?, count?, byAccount? }],
 *     reportExists, reportGeneratedAt, dataChangedAt, changedSinceReport, lateTransactions,
 *     action: 'wait' | 'generate' | 'regenerate' | 'none' }
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requireAgentOrUser(request);
  if (unauthorized) return unauthorized;

  const sp = request.nextUrl.searchParams;
  const fallback = previousMonthUk();
  const year = sp.has('year') ? Number(sp.get('year')) : fallback.year;
  const month = sp.has('month') ? Number(sp.get('month')) : fallback.month;
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getMonthReadiness(year, month));
  } catch (error) {
    console.error('GET /api/monthly-reports/readiness error:', error);
    return NextResponse.json({ error: 'Failed to check month readiness' }, { status: 500 });
  }
}
