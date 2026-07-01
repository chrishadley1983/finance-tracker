import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildAuthUrl, isTrueLayerConfigured, TrueLayerError } from '@/lib/truelayer';
import { tlStartAuthSchema } from '@/lib/validations/truelayer';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

function truelayerCallbackUrl(request: NextRequest): string {
  if (process.env.TRUELAYER_REDIRECT_URL) return process.env.TRUELAYER_REDIRECT_URL;
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host');
  return `${proto}://${host}/api/truelayer/callback`;
}

/**
 * POST /api/truelayer/auth/start
 * Creates a pending connection row (its id doubles as the OAuth `state`) and
 * returns the TrueLayer authorization URL for the browser to visit.
 */
export async function POST(request: NextRequest) {
  if (!isTrueLayerConfigured()) {
    return NextResponse.json({ error: 'TrueLayer is not configured' }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { providers } = tlStartAuthSchema.parse(body);

    const { data: pending, error: insErr } = await supabaseAdmin
      .from('truelayer_connections')
      .insert({ status: 'pending' })
      .select('id')
      .single();
    if (insErr || !pending) {
      return NextResponse.json({ error: `Failed to create connection: ${insErr?.message}` }, { status: 500 });
    }

    const url = buildAuthUrl({
      redirectUri: truelayerCallbackUrl(request),
      state: pending.id, // the pending connection id is the state
      providers,
    });
    return NextResponse.json({ url, state: pending.id });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof TrueLayerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 502 });
    }
    console.error('POST /api/truelayer/auth/start error:', error);
    return NextResponse.json({ error: 'Failed to start authorization' }, { status: 500 });
  }
}
