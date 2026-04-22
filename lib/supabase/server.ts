import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

/**
 * Disable Next.js/Vercel's default fetch cache for every Supabase request.
 *
 * Without this, responses to /api/transactions/summary (and any other route
 * whose Supabase queries hit the same literal URL repeatedly — e.g.
 * `...end=2026-04-30` for the whole of April) can be silently cached by
 * Vercel's Data Cache and served stale long after the underlying rows
 * have changed. A 2026-04-22 dashboard spot-check returned £3,458.70 for
 * April expenses while the live DB held £5,097.88 — exactly this bug.
 *
 * `export const dynamic = 'force-dynamic'` on a route only disables
 * route-level caching; it does not reach inside the Supabase client's
 * underlying fetch calls.
 */
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'finance',
  },
  global: {
    fetch: noStoreFetch,
  },
});

/**
 * SSR-aware Supabase client for auth operations (reads/writes session cookies).
 * Use this in Server Components, Route Handlers, and Middleware for auth checks.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
      global: {
        fetch: noStoreFetch,
      },
    }
  );
}
