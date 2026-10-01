import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrUser } from '@/lib/api/require-agent';
import { recategorisePending } from '@/lib/categorisation/recategorise';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/categorisation/recategorise-pending
 * Re-run rules + precedent (no AI) over the review queue and clear rows that
 * are now confidently categorised. Never touches manual or validated rows.
 * → { examined, changed, cleared }
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAgentOrUser(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await recategorisePending();
    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/categorisation/recategorise-pending error:', error);
    return NextResponse.json({ error: 'Re-categorisation failed' }, { status: 500 });
  }
}
