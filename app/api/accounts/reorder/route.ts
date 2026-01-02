import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { reorderAccountsSchema } from '@/lib/validations/accounts';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accounts } = reorderAccountsSchema.parse(body);

    // Update each account's sort_order
    const updates = accounts.map(({ id, sort_order }) =>
      supabaseAdmin
        .from('accounts')
        .update({ sort_order })
        .eq('id', id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/accounts/reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
