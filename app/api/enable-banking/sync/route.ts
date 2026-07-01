import { NextRequest, NextResponse } from 'next/server';
import { syncAccount, syncAllEnabledAccounts } from '@/lib/enable-banking/sync';
import { isEnableBankingConfigured, EnableBankingError } from '@/lib/enable-banking';
import { syncRequestSchema } from '@/lib/validations/enable-banking';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/enable-banking/sync
 * Body: { accountId?, dateFrom?, dateTo? }
 * With accountId → sync that account; otherwise sync all sync-enabled accounts.
 * Reconciles + inserts only missing transactions (never updates existing rows).
 */
export async function POST(request: NextRequest) {
  if (!isEnableBankingConfigured()) {
    return NextResponse.json({ error: 'Enable Banking is not configured' }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { accountId, dateFrom, dateTo } = syncRequestSchema.parse(body);

    const results = accountId
      ? [await syncAccount(accountId, { dateFrom, dateTo })]
      : await syncAllEnabledAccounts({ dateFrom, dateTo });

    const totals = results.reduce(
      (acc, r) => ({
        imported: acc.imported + r.imported,
        alreadyPresent: acc.alreadyPresent + r.alreadyPresent,
        pendingSkipped: acc.pendingSkipped + r.pendingSkipped,
      }),
      { imported: 0, alreadyPresent: 0, pendingSkipped: 0 },
    );

    return NextResponse.json({ success: true, totals, results });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof EnableBankingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 502 });
    }
    console.error('POST /api/enable-banking/sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
