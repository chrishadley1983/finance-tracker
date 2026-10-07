import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { bulkUpsertWealthSnapshotsSchema } from '@/lib/validations/wealth-snapshots';
import { ZodError } from 'zod';

/**
 * POST /api/wealth-snapshots/bulk
 *
 * Saves one month's balances for several accounts in a single request.
 * Rows are upserted on (account_id, date), so the whole month is written
 * together or not at all; accounts that aren't listed are left untouched.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, entries } = bulkUpsertWealthSnapshotsSchema.parse(body);

    const rows = entries.map((e) => ({ account_id: e.account_id, date, balance: e.balance }));
    const { data, error } = await supabaseAdmin
      .from('wealth_snapshots')
      .upsert(rows, { onConflict: 'account_id,date' })
      .select('id, account_id, balance');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: data?.length ?? 0, snapshots: data ?? [] });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('POST /api/wealth-snapshots/bulk error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
