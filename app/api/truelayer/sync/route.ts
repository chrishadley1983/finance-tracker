import { NextRequest, NextResponse } from 'next/server';
import { syncAccount, syncAllEnabledAccounts } from '@/lib/truelayer/sync';
import { isTrueLayerConfigured, TrueLayerError } from '@/lib/truelayer';
import { tlSyncRequestSchema } from '@/lib/validations/truelayer';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/truelayer/sync — { accountId?, dateFrom?, dateTo? }
 * Reconciles + inserts only missing transactions (never updates existing rows).
 */
export async function POST(request: NextRequest) {
  if (!isTrueLayerConfigured()) {
    return NextResponse.json({ error: 'TrueLayer is not configured' }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { accountId, dateFrom, dateTo } = tlSyncRequestSchema.parse(body);

    const results = accountId
      ? [await syncAccount(accountId, { dateFrom, dateTo })]
      : await syncAllEnabledAccounts({ dateFrom, dateTo });

    const totals = results.reduce(
      (acc, r) => ({ imported: acc.imported + r.imported, alreadyPresent: acc.alreadyPresent + r.alreadyPresent }),
      { imported: 0, alreadyPresent: 0 },
    );
    return NextResponse.json({ success: true, totals, results });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof TrueLayerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 502 });
    }
    console.error('POST /api/truelayer/sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
