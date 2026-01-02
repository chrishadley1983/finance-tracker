import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createAccountSchema } from '@/lib/validations/accounts';
import { ZodError } from 'zod';
import type { AccountWithStats } from '@/lib/types/account';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // First get all accounts
    let query = supabaseAdmin
      .from('accounts')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (!includeArchived) {
      // Include accounts where is_archived is false OR null (for legacy data)
      query = query.or('is_archived.eq.false,is_archived.is.null');
    }

    const { data: accounts, error } = await query;

    if (error) {
      console.error('Error fetching accounts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    console.log('Found accounts:', accounts.length);

    // Get transaction stats for each account
    const accountIds = accounts.map(a => a.id);
    console.log('Account IDs:', accountIds.length);

    // Get transaction stats using aggregation (avoids 1000 row limit)
    type TxStatsRow = {
      account_id: string;
      tx_count: number;
      earliest_date: string | null;
      latest_date: string | null;
      balance: number;
    };

    const txStatsByAccount: Record<string, {
      count: number;
      earliest: string | null;
      latest: string | null;
      balance: number;
    }> = {};

    if (accountIds.length > 0) {
      const { data: txStatsData, error: txError } = await supabaseAdmin
        .rpc('get_account_transaction_stats', { account_ids: accountIds }) as { data: TxStatsRow[] | null; error: Error | null };

      if (txError) {
        console.error('Error fetching transaction stats:', txError);
      } else if (txStatsData) {
        for (const row of txStatsData) {
          txStatsByAccount[row.account_id] = {
            count: row.tx_count,
            earliest: row.earliest_date,
            latest: row.latest_date,
            balance: row.balance,
          };
        }
      }
    }

    // Get investment valuations for investment accounts
    const investmentAccountIds = accounts
      .filter(a => ['investment', 'pension', 'isa'].includes(a.type))
      .map(a => a.id);

    const valuationsByAccount: Record<string, { count: number; latest: string | null; amount: number | null }> = {};

    if (investmentAccountIds.length > 0) {
      const { data: valuations, error: valError } = await supabaseAdmin
        .from('investment_valuations')
        .select('account_id, date, value')
        .in('account_id', investmentAccountIds)
        .order('date', { ascending: false });

      if (valError) {
        console.error('Error fetching valuations:', valError);
      } else if (valuations) {
        // Group valuations by account
        for (const v of valuations) {
          if (!valuationsByAccount[v.account_id]) {
            valuationsByAccount[v.account_id] = {
              count: 0,
              latest: null,
              amount: null,
            };
          }
          valuationsByAccount[v.account_id].count++;
          if (!valuationsByAccount[v.account_id].latest) {
            valuationsByAccount[v.account_id].latest = v.date;
            valuationsByAccount[v.account_id].amount = v.value;
          }
        }
      }
    }

    // Build response with stats
    const accountsWithStats: AccountWithStats[] = accounts.map(account => {
      const stats = txStatsByAccount[account.id] || {
        count: 0,
        earliest: null,
        latest: null,
        balance: 0,
      };
      const valStats = valuationsByAccount[account.id];

      // For investment accounts, use valuation; for others, use transaction balance
      let currentBalance = stats.balance;
      if (['investment', 'pension', 'isa'].includes(account.type) && valStats && valStats.amount !== null) {
        currentBalance = valStats.amount || 0;
      }

      return {
        ...account,
        transactionCount: stats.count,
        earliestTransaction: stats.earliest,
        latestTransaction: stats.latest,
        currentBalance: Math.round(currentBalance * 100) / 100,
        valuationCount: valStats?.count,
        latestValuation: valStats?.latest,
        latestValuationAmount: valStats?.amount,
      };
    });

    return NextResponse.json({ accounts: accountsWithStats });
  } catch (error) {
    console.error('GET /api/accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createAccountSchema.parse(body);

    // Check for duplicate name
    const { data: existing } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('name', validated.name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this name already exists' },
        { status: 400 }
      );
    }

    // Get max sort_order for new account
    const { data: maxSort } = await supabaseAdmin
      .from('accounts')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxSort?.sort_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        ...validated,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
