import { NextRequest, NextResponse } from 'next/server';
import { getAspsps, isEnableBankingConfigured, EnableBankingError } from '@/lib/enable-banking';

export const dynamic = 'force-dynamic';

/** GET /api/enable-banking/aspsps?country=GB — list available banks. */
export async function GET(request: NextRequest) {
  if (!isEnableBankingConfigured()) {
    return NextResponse.json({ error: 'Enable Banking is not configured' }, { status: 503 });
  }
  const country = (request.nextUrl.searchParams.get('country') || 'GB').toUpperCase();
  try {
    const aspsps = await getAspsps(country);
    return NextResponse.json({ country, aspsps });
  } catch (error) {
    const status = error instanceof EnableBankingError ? error.status || 502 : 502;
    console.error('GET /api/enable-banking/aspsps error:', error);
    return NextResponse.json({ error: 'Failed to fetch banks' }, { status });
  }
}
