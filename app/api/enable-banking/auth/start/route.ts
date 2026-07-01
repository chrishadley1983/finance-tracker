import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { startAuthorization, isEnableBankingConfigured, EnableBankingError } from '@/lib/enable-banking';
import { startAuthSchema } from '@/lib/validations/enable-banking';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const CONSENT_DAYS = 89; // just under HSBC's 90-day max

function callbackUrl(request: NextRequest): string {
  if (process.env.ENABLE_BANKING_REDIRECT_URL) return process.env.ENABLE_BANKING_REDIRECT_URL;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host');
  return `${proto}://${host}/api/enable-banking/callback`;
}

/**
 * POST /api/enable-banking/auth/start
 * Begins the HSBC consent flow. Returns { url } for the browser to visit.
 * A pending session row (keyed by `state`) is created so the callback can
 * correlate the returned code back to this request.
 */
export async function POST(request: NextRequest) {
  if (!isEnableBankingConfigured()) {
    return NextResponse.json({ error: 'Enable Banking is not configured' }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { aspspName, aspspCountry } = startAuthSchema.parse(body);

    const state = randomUUID();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + CONSENT_DAYS);

    // Record the pending authorization so the callback can find it by state.
    const { error: insErr } = await supabaseAdmin.from('enable_banking_sessions').insert({
      session_id: state, // temporary; replaced with the real session id on callback
      aspsp_name: aspspName,
      aspsp_country: aspspCountry,
      status: 'pending',
      valid_until: validUntil.toISOString(),
    });
    if (insErr) {
      return NextResponse.json({ error: `Failed to create session: ${insErr.message}` }, { status: 500 });
    }

    const auth = await startAuthorization({
      aspspName,
      aspspCountry,
      redirectUrl: callbackUrl(request),
      state,
      validUntil: validUntil.toISOString(),
      psuType: 'personal',
    });

    return NextResponse.json({ url: auth.url, state });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof EnableBankingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 502 });
    }
    console.error('POST /api/enable-banking/auth/start error:', error);
    return NextResponse.json({ error: 'Failed to start authorization' }, { status: 500 });
  }
}
