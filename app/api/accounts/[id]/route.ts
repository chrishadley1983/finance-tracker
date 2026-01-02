import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { updateAccountSchema } from '@/lib/validations/accounts';
import { ZodError } from 'zod';
import type { AccountWithStats } from '@/lib/types/account';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get account
    const { data: account, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get transaction stats
    const { data: txStats } = await supabaseAdmin
      .from('transactions')
      .select('date, amount')
      .eq('account_id', id);

    let transactionCount = 0;
    let earliestTransaction: string | null = null;
    let latestTransaction: string | null = null;
    let currentBalance = 0;

    if (txStats) {
      transactionCount = txStats.length;
      for (const tx of txStats) {
        currentBalance += Number(tx.amount);
        if (!earliestTransaction || tx.date < earliestTransaction) {
          earliestTransaction = tx.date;
        }
        if (!latestTransaction || tx.date > latestTransaction) {
          latestTransaction = tx.date;
        }
      }
    }

    // For investment accounts, get valuation data
    let valuationCount: number | undefined;
    let latestValuation: string | null | undefined;
    let latestValuationAmount: number | null | undefined;

    if (['investment', 'pension', 'isa'].includes(account.type)) {
      const { data: valuations } = await supabaseAdmin
        .from('investment_valuations')
        .select('date, value')
        .eq('account_id', id)
        .order('date', { ascending: false });

      if (valuations && valuations.length > 0) {
        valuationCount = valuations.length;
        latestValuation = valuations[0].date;
        latestValuationAmount = valuations[0].value;
        currentBalance = valuations[0].value;
      }
    }

    const accountWithStats: AccountWithStats = {
      ...account,
      transactionCount,
      earliestTransaction,
      latestTransaction,
      currentBalance: Math.round(currentBalance * 100) / 100,
      valuationCount,
      latestValuation,
      latestValuationAmount,
    };

    return NextResponse.json({ account: accountWithStats });
  } catch (error) {
    console.error('GET /api/accounts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateAccountSchema.parse(body);

    // Check if account exists
    const { data: existing, error: existError } = await supabaseAdmin
      .from('accounts')
      .select('id, name')
      .eq('id', id)
      .single();

    if (existError || !existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // If updating name, check for duplicates
    if (validated.name && validated.name !== existing.name) {
      const { data: duplicate } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('name', validated.name)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: 'An account with this name already exists' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PATCH /api/accounts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Keep PUT for backwards compatibility
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return PATCH(request, { params });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Check if account exists and get transaction count
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, name')
      .eq('id', id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get transaction count
    const { count: txCount, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const transactionCount = txCount || 0;

    // If has transactions and not forcing, return error
    if (transactionCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `Account has ${transactionCount} transactions. Use force=true or reallocate first.`,
          transactionCount,
        },
        { status: 400 }
      );
    }

    // If forcing, delete transactions first
    if (transactionCount > 0 && force) {
      // Get transaction IDs first
      const { data: txIds } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('account_id', id);

      if (txIds && txIds.length > 0) {
        // Delete transaction hashes first (foreign key constraint)
        const { error: hashError } = await supabaseAdmin
          .from('imported_transaction_hashes')
          .delete()
          .in('transaction_id', txIds.map(t => t.id));

        if (hashError) {
          console.error('Error deleting transaction hashes:', hashError);
        }
      }

      // Delete transactions
      const { error: txError } = await supabaseAdmin
        .from('transactions')
        .delete()
        .eq('account_id', id);

      if (txError) {
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }
    }

    // Delete any investment valuations
    await supabaseAdmin
      .from('investment_valuations')
      .delete()
      .eq('account_id', id);

    // Delete any wealth snapshots
    await supabaseAdmin
      .from('wealth_snapshots')
      .delete()
      .eq('account_id', id);

    // Delete the account
    const { error } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedTransactions: force ? transactionCount : 0,
    });
  } catch (error) {
    console.error('DELETE /api/accounts/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
