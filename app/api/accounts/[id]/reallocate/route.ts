import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { reallocateTransactionsSchema } from '@/lib/validations/accounts';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: sourceAccountId } = await params;
    const body = await request.json();
    const { targetAccountId } = reallocateTransactionsSchema.parse(body);

    // Validate source account exists
    const { data: sourceAccount, error: sourceError } = await supabaseAdmin
      .from('accounts')
      .select('id, name')
      .eq('id', sourceAccountId)
      .single();

    if (sourceError || !sourceAccount) {
      return NextResponse.json(
        { error: 'Source account not found' },
        { status: 404 }
      );
    }

    // Validate target account exists and is not archived
    const { data: targetAccount, error: targetError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, is_archived')
      .eq('id', targetAccountId)
      .single();

    if (targetError || !targetAccount) {
      return NextResponse.json(
        { error: 'Target account not found' },
        { status: 404 }
      );
    }

    // Cannot reallocate to same account
    if (sourceAccountId === targetAccountId) {
      return NextResponse.json(
        { error: 'Cannot reallocate to the same account' },
        { status: 400 }
      );
    }

    // Cannot reallocate to archived account
    if (targetAccount.is_archived) {
      return NextResponse.json(
        { error: 'Cannot reallocate to an archived account' },
        { status: 400 }
      );
    }

    // Get count of transactions to move
    const { count: txCount, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', sourceAccountId);

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    const transactionCount = txCount || 0;

    if (transactionCount === 0) {
      return NextResponse.json({
        success: true,
        transactionsMoved: 0,
      });
    }

    // Move all transactions
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ account_id: targetAccountId })
      .eq('account_id', sourceAccountId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update last_import_at on target account
    await supabaseAdmin
      .from('accounts')
      .update({ last_import_at: new Date().toISOString() })
      .eq('id', targetAccountId);

    return NextResponse.json({
      success: true,
      transactionsMoved: transactionCount,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/accounts/[id]/reallocate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
