import { NextRequest, NextResponse } from 'next/server';
import { syncAllEnabledAccounts } from '@/lib/enable-banking/sync';
import { isEnableBankingConfigured } from '@/lib/enable-banking';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/enable-banking/cron
 * Scheduled sync of all enabled accounts. Protected by CRON_SECRET
 * (set as the Bearer token; Vercel Cron sends this automatically).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isEnableBankingConfigured()) {
    return NextResponse.json({ error: 'Enable Banking is not configured' }, { status: 503 });
  }
  try {
    const results = await syncAllEnabledAccounts();
    const imported = results.reduce((n, r) => n + r.imported, 0);
    return NextResponse.json({ success: true, accountsSynced: results.length, imported, results });
  } catch (error) {
    console.error('EB cron error:', error);
    return NextResponse.json({ error: 'Cron sync failed' }, { status: 500 });
  }
}
