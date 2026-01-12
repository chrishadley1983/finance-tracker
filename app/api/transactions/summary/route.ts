import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type TimeframePeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'all_time' | 'custom';

function getDateRange(period: TimeframePeriod, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case 'this_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStart, 1);
      const end = new Date(year, quarterStart + 3, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'last_quarter': {
      const currentQuarterStart = Math.floor(month / 3) * 3;
      const start = new Date(year, currentQuarterStart - 3, 1);
      const end = new Date(year, currentQuarterStart, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'this_year': {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'last_year': {
      const start = new Date(year - 1, 0, 1);
      const end = new Date(year - 1, 11, 31);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'custom': {
      if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd };
      }
      // Fall through to all_time if no custom dates provided
    }
    case 'all_time':
    default: {
      return {
        startDate: '1900-01-01',
        endDate: '2100-12-31',
      };
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'this_month') as TimeframePeriod;
    const customStart = searchParams.get('start') || undefined;
    const customEnd = searchParams.get('end') || undefined;

    const { startDate, endDate } = getDateRange(period, customStart, customEnd);

    // Get all active accounts that should be included in net worth
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, type, include_in_net_worth')
      .or('is_archived.eq.false,is_archived.is.null')
      .or('include_in_net_worth.eq.true,include_in_net_worth.is.null');

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    const accountIds = accounts?.map(a => a.id) || [];
    const investmentAccountIds = accounts
      ?.filter(a => ['investment', 'pension', 'isa'].includes(a.type))
      .map(a => a.id) || [];

    // Get transaction balances using RPC to avoid row limits
    const txBalanceByAccount = new Map<string, number>();

    if (accountIds.length > 0) {
      type TxStatsRow = {
        account_id: string;
        tx_count: number;
        earliest_date: string | null;
        latest_date: string | null;
        balance: number;
      };

      const { data: txStatsData, error: txError } = await supabaseAdmin
        .rpc('get_account_transaction_stats', { account_ids: accountIds }) as { data: TxStatsRow[] | null; error: Error | null };

      if (txError) {
        console.error('Error fetching transaction stats:', txError);
      } else if (txStatsData) {
        for (const row of txStatsData) {
          txBalanceByAccount.set(row.account_id, row.balance);
        }
      }
    }

    // Get wealth snapshots with calculated balances (snapshot + transactions from snapshot date)
    type SnapshotBalanceRow = {
      account_id: string;
      snapshot_date: string;
      snapshot_balance: number;
      transactions_sum: number;
      current_balance: number;
    };

    const { data: snapshotBalances, error: snapError } = await supabaseAdmin
      .rpc('get_account_balances_with_snapshots', { account_ids: accountIds }) as { data: SnapshotBalanceRow[] | null; error: Error | null };

    if (snapError) {
      console.error('Error fetching snapshot balances:', snapError);
    }

    const snapshotByAccount = new Map<string, { balance: number; currentBalance: number }>();
    for (const s of snapshotBalances || []) {
      snapshotByAccount.set(s.account_id, {
        balance: s.snapshot_balance,
        currentBalance: s.current_balance,
      });
    }

    // Get latest investment valuations
    const { data: valuations, error: valError } = await supabaseAdmin
      .from('investment_valuations')
      .select('account_id, value')
      .in('account_id', investmentAccountIds)
      .order('date', { ascending: false });

    if (valError) {
      console.error('Error fetching investment valuations:', valError);
    }

    // Get latest valuation per account
    const valuationByAccount = new Map<string, number>();
    for (const v of valuations || []) {
      if (!valuationByAccount.has(v.account_id)) {
        valuationByAccount.set(v.account_id, v.value);
      }
    }

    // Calculate total balance using appropriate source for each account
    let totalBalance = 0;
    for (const account of accounts || []) {
      const isInvestmentType = ['investment', 'pension', 'isa'].includes(account.type);

      if (isInvestmentType) {
        // Investment accounts: use valuation > snapshot > transactions
        if (valuationByAccount.has(account.id)) {
          totalBalance += valuationByAccount.get(account.id)!;
        } else if (snapshotByAccount.has(account.id)) {
          // Investment accounts: use snapshot balance only (not combined with transactions)
          totalBalance += snapshotByAccount.get(account.id)!.balance;
        } else if (txBalanceByAccount.has(account.id)) {
          totalBalance += txBalanceByAccount.get(account.id)!;
        }
      } else {
        // Non-investment accounts: use snapshot + transactions from snapshot date
        if (snapshotByAccount.has(account.id)) {
          totalBalance += snapshotByAccount.get(account.id)!.currentBalance;
        } else if (txBalanceByAccount.has(account.id)) {
          totalBalance += txBalanceByAccount.get(account.id)!;
        }
      }
    }

    // Get all categories to determine income vs expense and exclusions
    const { data: allCategories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, is_income, exclude_from_totals');

    if (catError) {
      console.error('Error fetching categories:', catError);
    }

    const excludedCategoryIds = new Set(
      allCategories?.filter(c => c.exclude_from_totals).map(c => c.id) || []
    );
    const incomeCategoryIds = new Set(
      allCategories?.filter(c => c.is_income).map(c => c.id) || []
    );

    // Get transactions for the selected period using pagination to overcome 1000 row limit
    const allPeriodTransactions: { amount: number; category_id: string | null }[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('transactions')
        .select('amount, category_id')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('id')  // Consistent ordering for pagination
        .range(from, from + batchSize - 1);

      if (batchError) {
        return NextResponse.json({ error: batchError.message }, { status: 500 });
      }

      if (batch && batch.length > 0) {
        allPeriodTransactions.push(...batch);
        from += batchSize;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Filter out transactions in excluded categories
    const includedTransactions = allPeriodTransactions.filter(
      t => !t.category_id || !excludedCategoryIds.has(t.category_id)
    );

    // Calculate income based on category (is_income flag), not amount sign
    // Income = absolute value of transactions in income categories
    // Expenses = absolute value of transactions NOT in income categories
    const periodIncome = includedTransactions
      .filter((t) => t.category_id && incomeCategoryIds.has(t.category_id))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const periodExpenses = includedTransactions
      .filter((t) => !t.category_id || !incomeCategoryIds.has(t.category_id))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const periodNet = periodIncome - periodExpenses;

    return NextResponse.json({
      totalBalance: Math.round(totalBalance * 100) / 100,
      periodIncome,
      periodExpenses,
      periodNet,
      period,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction summary' },
      { status: 500 }
    );
  }
}
