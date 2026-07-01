import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { exchangeCode, getAccounts, getCards } from '@/lib/truelayer';

export const dynamic = 'force-dynamic';

const UI_PATH = '/settings/bank-sync';

function callbackUrl(request: NextRequest): string {
  if (process.env.TRUELAYER_REDIRECT_URL) return process.env.TRUELAYER_REDIRECT_URL;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host');
  return `${proto}://${host}/api/truelayer/callback`;
}

function redirectTo(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL(UI_PATH, request.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * GET /api/truelayer/callback?code=...&state=...
 * TrueLayer redirects here after consent. `state` is the pending connection id.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const code = p.get('code');
  const state = p.get('state');
  const err = p.get('error');

  if (err) return redirectTo(request, { status: 'error', message: err, provider: 'truelayer' });
  if (!code || !state) {
    return redirectTo(request, { status: 'error', message: 'Missing code or state', provider: 'truelayer' });
  }

  const { data: pending, error: pendErr } = await supabaseAdmin
    .from('truelayer_connections')
    .select('id, status')
    .eq('id', state)
    .eq('status', 'pending')
    .single();
  if (pendErr || !pending) {
    return redirectTo(request, { status: 'error', message: 'Unknown or expired authorization', provider: 'truelayer' });
  }

  try {
    const tokens = await exchangeCode(code, callbackUrl(request));
    const accounts = await getAccounts(tokens.access_token).catch(() => []);
    const cards = await getCards(tokens.access_token).catch(() => []);
    const provider = accounts[0]?.provider ?? cards[0]?.provider;

    const { error: updErr } = await supabaseAdmin
      .from('truelayer_connections')
      .update({
        status: 'active',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ?? null,
        provider_id: provider?.provider_id ?? null,
        provider_name: provider?.display_name ?? null,
        raw: { accounts, cards } as never,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pending.id);
    if (updErr) {
      return redirectTo(request, { status: 'error', message: 'Failed to store connection', provider: 'truelayer' });
    }

    return redirectTo(request, { status: 'linked', connection: pending.id, provider: 'truelayer' });
  } catch (error) {
    console.error('TrueLayer callback error:', error);
    return redirectTo(request, { status: 'error', message: 'Failed to complete authorization', provider: 'truelayer' });
  }
}
