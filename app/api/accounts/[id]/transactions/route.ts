import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(50),
  offset: z.coerce.number().min(0).default(0),
  sort_direction: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const query = querySchema.parse({
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      sort_direction: searchParams.get('sort_direction') || undefined,
    });

    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    // Get the latest wealth snapshot for this account (opening balance adjustment)
    const { data: snapshot } = await supabaseAdmin
      .from('wealth_snapshots')
      .select('date, balance')
      .eq('account_id', accountId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    // Starting balance from snapshot (if exists)
    const snapshotBalance = snapshot?.balance ?? 0;
    const snapshotDate = snapshot?.date ?? null;

    // Fetch ALL transactions for this account to calculate running balances
    // We need to paginate to avoid Supabase's 1000 row limit
    const allTransactions: { id: string; amount: number; date: string }[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('transactions')
        .select('id, amount, date')
        .eq('account_id', accountId)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (batchError) {
        return NextResponse.json(
          { error: batchError.message },
          { status: 500 }
        );
      }

      if (batch && batch.length > 0) {
        allTransactions.push(...batch);
        offset += batch.length;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Calculate cumulative running balances and create a map by ID
    // If we have a snapshot, start from that balance and only count transactions from snapshot date
    const balanceMap = new Map<string, number>();
    let runningTotal = snapshotBalance;

    for (const tx of allTransactions) {
      // If there's a snapshot, only add transactions from the snapshot date onwards (inclusive)
      if (snapshotDate && tx.date < snapshotDate) {
        // Transaction is before snapshot - don't include in running total
        // For pre-snapshot transactions, show null to indicate N/A
        balanceMap.set(tx.id, Number.MIN_SAFE_INTEGER); // Sentinel value for "not applicable"
      } else {
        runningTotal += tx.amount;
        balanceMap.set(tx.id, runningTotal);
      }
    }

    // Now fetch the paginated transactions with full details
    const isDescending = query.sort_direction === 'desc';

    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select(`
        *,
        category:categories(name, group_name)
      `)
      .eq('account_id', accountId)
      .order('date', { ascending: !isDescending })
      .order('id', { ascending: !isDescending })
      .range(query.offset, query.offset + query.limit - 1);

    if (txError) {
      return NextResponse.json(
        { error: txError.message },
        { status: 500 }
      );
    }

    // Add running balance to each transaction
    // Use null for pre-snapshot transactions where balance is not applicable
    const transactionsWithBalance = (transactions || []).map((tx) => {
      const balance = balanceMap.get(tx.id);
      return {
        ...tx,
        running_balance: balance === Number.MIN_SAFE_INTEGER ? null : (balance ?? 0),
        account: { name: account.name },
      };
    });

    return NextResponse.json({
      data: transactionsWithBalance,
      total: count ?? 0,
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        current_balance: runningTotal,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('GET /api/accounts/[id]/transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
