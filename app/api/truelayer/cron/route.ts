import { NextRequest, NextResponse } from 'next/server';
import { syncAllEnabledAccounts } from '@/lib/truelayer/sync';
import { isTrueLayerConfigured } from '@/lib/truelayer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/truelayer/cron — scheduled sync of all enabled accounts (CRON_SECRET-guarded). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isTrueLayerConfigured()) {
    return NextResponse.json({ error: 'TrueLayer is not configured' }, { status: 503 });
  }
  try {
    const results = await syncAllEnabledAccounts();
    const imported = results.reduce((n, r) => n + r.imported, 0);
    return NextResponse.json({ success: true, accountsSynced: results.length, imported, results });
  } catch (error) {
    console.error('TrueLayer cron error:', error);
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 });
  }
}
