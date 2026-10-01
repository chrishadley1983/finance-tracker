import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrUser } from '@/lib/api/require-agent';
import { getLearningStats } from '@/lib/categorisation/learning-stats';

export const dynamic = 'force-dynamic';

/**
 * GET /api/categorisation/learning-stats?days=30
 * Auth: x-api-key = FINANCE_AGENT_KEY (or a logged-in session).
 *
 * → { days,
 *     current:  { from, to, auto, corrected, rate, bySource: { <engine_source>: { auto, corrected, rate } } },
 *     previous: { …same shape, the preceding window },
 *     rules: { created, repointed, deleted, updated },   // category_rule_events in the current window
 *     reviewQueue,                                       // rows with needs_review = true now
 *     topCorrectedMerchants: [{ merchant, corrections, toCategory }] }
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requireAgentOrUser(request);
  if (unauthorized) return unauthorized;

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === null ? 30 : Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: 'days must be an integer between 1 and 365' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getLearningStats(days));
  } catch (error) {
    console.error('GET /api/categorisation/learning-stats error:', error);
    return NextResponse.json({ error: 'Failed to compute learning stats' }, { status: 500 });
  }
}
