import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ACCOUNT_TYPE_LABELS, type NetWorthSummary } from '@/lib/types/fire';

// =============================================================================
// GET - Current net worth summary
// =============================================================================

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, is_active')
      .eq('is_active', true);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      const emptyResult: NetWorthSummary = {
        date: today,
        total: 0,
        previousTotal: null,
        change: null,
        changePercent: null,
        byType: [],
        byAccount: [],
      };
      return NextResponse.json(emptyResult);
    }

    const accountIds = accounts.map((a: { id: string }) => a.id);

    // Use the same RPC function as the Accounts API to get accurate balances
    // This calculates: snapshot_balance + transactions_since_snapshot_date
    type SnapshotBalanceRow = {
      account_id: string;
      snapshot_date: string;
      snapshot_balance: number;
      transactions_sum: number;
      current_balance: number;
    };

    const snapshotBalances = new Map<string, number>();
    if (accountIds.length > 0) {
      const { data: balanceData, error: balanceError } = await supabaseAdmin
        .rpc('get_account_balances_with_snapshots', { account_ids: accountIds }) as {
          data: SnapshotBalanceRow[] | null;
          error: Error | null
        };

      if (balanceError) {
        console.error('Error fetching snapshot balances:', balanceError);
      } else if (balanceData) {
        for (const row of balanceData) {
          snapshotBalances.set(row.account_id, row.current_balance);
        }
      }
    }

    // Build account balances
    const byAccount: NetWorthSummary['byAccount'] = [];
    const typeBalances = new Map<string, number>();

    for (const account of accounts) {
      // Use the calculated balance from snapshot + subsequent transactions
      const balance = snapshotBalances.get(account.id) || 0;

      byAccount.push({
        accountId: account.id,
        accountName: account.name,
        accountType: account.type,
        balance,
      });

      // Aggregate by type
      const currentTypeTotal = typeBalances.get(account.type) || 0;
      typeBalances.set(account.type, currentTypeTotal + balance);
    }

    // Convert type balances to array
    const byType = Array.from(typeBalances.entries())
      .map(([type, total]) => ({
        type,
        label: ACCOUNT_TYPE_LABELS[type] || type,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    const total = byAccount.reduce((sum, a) => sum + a.balance, 0);

    // Get previous month total for comparison
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().split('T')[0];

    // Get previous wealth snapshots for all accounts
    let previousTotal = 0;
    if (accountIds.length > 0) {
      const { data: prevSnapshots } = await supabaseAdmin
        .from('wealth_snapshots')
        .select('account_id, balance')
        .in('account_id', accountIds)
        .lte('date', lastMonthStr)
        .order('date', { ascending: false });

      const prevSnapMap = new Map<string, number>();
      for (const s of prevSnapshots || []) {
        if (!prevSnapMap.has(s.account_id)) {
          prevSnapMap.set(s.account_id, Number(s.balance));
        }
      }
      previousTotal = Array.from(prevSnapMap.values()).reduce((a, b) => a + b, 0);
    }
    const change = previousTotal > 0 ? total - previousTotal : null;
    const changePercent = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;

    const result: NetWorthSummary = {
      date: today,
      total,
      previousTotal: previousTotal > 0 ? previousTotal : null,
      change,
      changePercent,
      byType,
      byAccount: byAccount.sort((a, b) => b.balance - a.balance),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
