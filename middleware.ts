import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { apiAuthMode, decideApiAccess, isAllowedEmail } from '@/lib/api/access-policy';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;
  const mode = apiAuthMode(process.env.API_AUTH_MODE);

  // The Supabase project is shared with other apps and has other users: only allowlisted emails
  // count as logged in here. In audit mode a non-listed user is logged and let through.
  const isAllowedUser = (email: string | undefined): boolean => {
    if (isAllowedEmail(email, process.env.FINANCE_ALLOWED_EMAILS)) return true;
    console.warn(
      JSON.stringify({
        event: mode === 'audit' ? 'auth_would_deny_email' : 'auth_denied_email',
        reason: 'not_allowed_email',
        path: pathname,
      })
    );
    return mode === 'audit';
  };

  // API: a session, an agent key or the cron bearer (lib/api/access-policy.ts).
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const decision = await decideApiAccess({
      path: pathname,
      apiKey: request.headers.get('x-api-key'),
      authorization: request.headers.get('authorization'),
      hasUser: async () => {
        // Refreshes the session cookie when it has expired, like the page branch below.
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return Boolean(user) && isAllowedUser(user?.email);
      },
      env: {
        FINANCE_AGENT_KEY: process.env.FINANCE_AGENT_KEY,
        FINANCE_API_KEYS: process.env.FINANCE_API_KEYS,
        CRON_SECRET: process.env.CRON_SECRET,
      },
    });
    if (decision.allow) return supabaseResponse;

    console.warn(
      JSON.stringify({
        event: mode === 'audit' ? 'api_auth_would_deny' : 'api_auth_denied',
        reason: decision.reason,
        method: request.method,
        path: pathname,
        ua: request.headers.get('user-agent') ?? '',
      })
    );
    if (mode === 'audit') return supabaseResponse;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Refresh session if expired
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  const user = sessionUser && isAllowedUser(sessionUser.email) ? sessionUser : null;

  const isAuthPage = pathname.startsWith('/login');

  // Publicly accessible pages (no login required) — e.g. the legal pages
  // linked from the Enable Banking application registration.
  const isPublicPage = ['/privacy', '/terms'].some((p) => pathname.startsWith(p));

  // All non-auth, non-public pages are protected
  const isProtectedRoute = !isAuthPage && !isPublicPage;

  // Redirect unauthenticated users to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    if (sessionUser) url.searchParams.set('error', 'not_allowed');
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && isAuthPage) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/';
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.searchParams.delete('redirectTo');
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
