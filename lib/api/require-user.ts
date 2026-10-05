import { NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';

/**
 * API route-handler auth guard.
 *
 * `middleware.ts` gates every `/api/*` call (session, agent key or cron bearer;
 * see lib/api/access-policy.ts). Route handlers that need a *user* specifically,
 * not an agent, can still call this at the top of the handler:
 *
 *   const unauthorized = await requireUser();
 *   if (unauthorized) return unauthorized;
 *
 * Returns `null` when a valid Supabase session is present, or a ready-to-
 * return 401 `NextResponse` when not.
 */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
