import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { reorderAccountsSchema } from '@/lib/validations/accounts';
import { ZodError } from 'zod';

/**
 * POST /api/accounts/reorder
 * Body: { accounts: [{ id, sort_order }] } → sets each account's sort_order.
 * Any failed update returns 500 with the ids that failed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accounts } = reorderAccountsSchema.parse(body);

    const results = await Promise.all(
      accounts.map(({ id, sort_order }) => supabaseAdmin.from('accounts').update({ sort_order }).eq('id', id))
    );
    const failed = accounts.filter((_, i) => results[i]?.error).map((a) => a.id);
    if (failed.length > 0) {
      console.error('POST /api/accounts/reorder: failed updates', failed, results.find((r) => r?.error)?.error);
      return NextResponse.json({ error: 'Could not save the new order', failed }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    console.error('POST /api/accounts/reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
