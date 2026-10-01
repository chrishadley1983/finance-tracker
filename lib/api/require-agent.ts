import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from './require-user';

/**
 * Auth guard for routes called by automation (Peter's daily categorisation
 * job, Claude Code skills) as well as the logged-in app.
 *
 * - `x-api-key` header present → must equal FINANCE_AGENT_KEY (constant-time).
 * - No header → falls back to a normal Supabase session (requireUser).
 *
 * Returns null when authorised, or a ready-to-return 401.
 */
export async function requireAgentOrUser(request: NextRequest): Promise<NextResponse | null> {
  const provided = request.headers.get('x-api-key');
  if (provided !== null) {
    return isValidAgentKey(provided)
      ? null
      : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return requireUser();
}

export function isValidAgentKey(provided: string): boolean {
  const expected = process.env.FINANCE_AGENT_KEY;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
