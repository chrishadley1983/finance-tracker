import { NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';

/**
 * API route-handler auth guard.
 *
 * `middleware.ts` deliberately excludes `/api/*` from its auth gate, so any
 * route handler that mutates data or exposes user-specific financial data
 * must enforce auth itself. Call this at the top of the handler:
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
