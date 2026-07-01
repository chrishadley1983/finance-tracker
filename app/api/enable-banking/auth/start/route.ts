import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { startAuthorization, getAspsps, isEnableBankingConfigured, EnableBankingError } from '@/lib/enable-banking';
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

    // Resolve the exact connector name from the live ASPSP list when possible
    // (authoritative once the app is active). Falls back to the provided/default
    // name while the app is still inactive (/aspsps 403s in restricted mode).
    let connectorName = aspspName;
    try {
      const banks = await getAspsps(aspspCountry);
      const preferred =
        banks.find((b) => b.name === aspspName) ||
        banks.find((b) => /hsbc/i.test(b.name) && /personal/i.test(b.name)) ||
        banks.find((b) => /hsbc/i.test(b.name) && (b.psu_types?.includes('personal') ?? false));
      if (preferred) connectorName = preferred.name;
    } catch {
      /* app not active yet — use the default; startAuthorization will surface it */
    }

    const state = randomUUID();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + CONSENT_DAYS);

    // Record the pending authorization so the callback can find it by state.
    const { error: insErr } = await supabaseAdmin.from('enable_banking_sessions').insert({
      session_id: state, // temporary; replaced with the real session id on callback
      aspsp_name: connectorName,
      aspsp_country: aspspCountry,
      status: 'pending',
      valid_until: validUntil.toISOString(),
    });
    if (insErr) {
      return NextResponse.json({ error: `Failed to create session: ${insErr.message}` }, { status: 500 });
    }

    let auth;
    try {
      auth = await startAuthorization({
        aspspName: connectorName,
        aspspCountry,
        redirectUrl: callbackUrl(request),
        state,
        validUntil: validUntil.toISOString(),
        psuType: 'personal',
      });
    } catch (e) {
      // Don't leave an orphaned pending row behind on failure.
      await supabaseAdmin
        .from('enable_banking_sessions')
        .delete()
        .eq('session_id', state)
        .eq('status', 'pending');
      throw e;
    }

    return NextResponse.json({ url: auth.url, state });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof EnableBankingError) {
      // Production apps start in "restricted mode" and can't self-activate via
      // their own API. The owner must first link their account once in the
      // Enable Banking control panel ("Activate by linking accounts"), after
      // which this flow works. Surface that as actionable guidance.
      const notActive =
        error.status === 403 ||
        (error.body &&
          typeof error.body === 'object' &&
          /not active/i.test(String((error.body as { message?: unknown }).message ?? '')));
      if (notActive) {
        return NextResponse.json(
          {
            error:
              'Your Enable Banking app isn’t active yet. Activate it once by linking your HSBC account in the Enable Banking control panel (enablebanking.com/cp/applications → "Activate by linking accounts"), then return here to connect.',
            code: 'APP_NOT_ACTIVE',
            controlPanelUrl: 'https://enablebanking.com/cp/applications',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 502 });
    }
    console.error('POST /api/enable-banking/auth/start error:', error);
    return NextResponse.json({ error: 'Failed to start authorization' }, { status: 500 });
  }
}
