import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createSession, getAccountDetails, type EnableBankingAccountRef } from '@/lib/enable-banking';

export const dynamic = 'force-dynamic';

const UI_PATH = '/settings/bank-sync';

function redirectTo(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL(UI_PATH, request.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * GET /api/enable-banking/callback?code=...&state=...
 * The bank redirects here after the user grants consent. We exchange the code
 * for a session, enrich it with account details, and hand off to the linking UI.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const bankError = params.get('error');

  if (bankError) {
    return redirectTo(request, { status: 'error', message: bankError });
  }
  if (!code || !state) {
    return redirectTo(request, { status: 'error', message: 'Missing code or state' });
  }

  // Correlate to the pending authorization.
  const { data: pending, error: pendErr } = await supabaseAdmin
    .from('enable_banking_sessions')
    .select('id, status')
    .eq('session_id', state)
    .eq('status', 'pending')
    .single();
  if (pendErr || !pending) {
    return redirectTo(request, { status: 'error', message: 'Unknown or expired authorization state' });
  }

  try {
    const session = await createSession(code);

    // Enrich each consented account with its details (best-effort).
    const accountsData: EnableBankingAccountRef[] = [];
    for (const uid of session.accounts ?? []) {
      try {
        const details = await getAccountDetails(uid);
        accountsData.push({ ...details, uid });
      } catch {
        accountsData.push({ uid });
      }
    }

    const validUntil = session.access?.valid_until;
    const { error: updErr } = await supabaseAdmin
      .from('enable_banking_sessions')
      .update({
        session_id: session.session_id,
        status: 'active',
        raw: { accounts: accountsData, aspsp: session.aspsp, access: session.access } as never,
        ...(validUntil ? { valid_until: validUntil } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pending.id);
    if (updErr) {
      return redirectTo(request, { status: 'error', message: 'Failed to store session' });
    }

    return redirectTo(request, { status: 'linked', session: pending.id });
  } catch (error) {
    console.error('EB callback error:', error);
    return redirectTo(request, { status: 'error', message: 'Failed to complete bank authorization' });
  }
}
