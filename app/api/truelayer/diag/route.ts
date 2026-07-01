import { NextResponse } from 'next/server';
import { isTrueLayerConfigured, trueLayerHosts } from '@/lib/truelayer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/truelayer/diag
 * Server-side credential health check. Exercises the configured client_id +
 * client_secret against the token endpoint and reports whether they're valid,
 * WITHOUT ever exposing the secret. Used to confirm setup before running the
 * full OAuth consent flow. (A wrong secret returns `invalid_client`; a valid
 * secret with an unsupported grant returns a different error — both mean the
 * credentials themselves are accepted.)
 */
export async function GET() {
  if (!isTrueLayerConfigured()) {
    return NextResponse.json({ configured: false, credentialsValid: false });
  }
  const { auth } = trueLayerHosts();
  try {
    const res = await fetch(`${auth}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.TRUELAYER_CLIENT_ID as string,
        client_secret: process.env.TRUELAYER_CLIENT_SECRET as string,
        scope: 'data:read',
      }).toString(),
    });
    const text = await res.text().catch(() => '');
    let error: string | undefined;
    try {
      error = JSON.parse(text)?.error;
    } catch {
      error = undefined;
    }
    const invalidClient = error === 'invalid_client';
    return NextResponse.json({
      configured: true,
      tokenStatus: res.status,
      error: error ?? null,
      credentialsValid: !invalidClient,
      env: (process.env.TRUELAYER_ENV ?? 'live').toLowerCase(),
    });
  } catch (e) {
    return NextResponse.json(
      { configured: true, credentialsValid: false, error: 'request_failed', detail: String(e).slice(0, 120) },
      { status: 502 },
    );
  }
}
