import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ACCOUNT_TYPE_LABELS, type NetWorthSummary } from '@/lib/types/fire';
import { buildValuer, previousMonthEnd } from '@/lib/wealth/net-worth';
import { ukToday } from '@/plan/inputs/uk-date.mjs';
import { loadBalanceData } from '@/lib/wealth/load';

// Always per-request: live balances (a static build-time response would freeze net worth).
export const dynamic = 'force-dynamic';

// =============================================================================
// GET - Current net worth summary
// =============================================================================

export async function GET() {
  try {
    const today = ukToday();

    // Active accounts that count towards net worth (include_in_net_worth, as the monthly report does)
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, is_active')
      .eq('is_active', true)
      .eq('include_in_net_worth', true);

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

    // "Since last month": last month-end valued the same way as today (snapshot + later transactions
    // for current/credit accounts), over the accounts that existed then. Comparing today's
    // transaction-adjusted total with raw old snapshots counted months of movement as one month's.
    // Change is over the accounts valued at both dates, so a newly added account's balance is not a "gain".
    // A failure here degrades to "no comparison" rather than failing the headline.
    let previousTotal: number | null = null;
    let change: number | null = null;
    try {
      const prevEnd = previousMonthEnd(today);
      const { snapshots, transactions } = await loadBalanceData(accounts, { upTo: prevEnd });
      const valuer = buildValuer(snapshots, transactions);
      for (const a of accounts) {
        const prev = valuer.balanceAt(a, prevEnd);
        if (prev === null) continue;
        previousTotal = (previousTotal ?? 0) + prev;
        change = (change ?? 0) + ((snapshotBalances.get(a.id) || 0) - prev);
      }
    } catch (e) {
      console.error('Net worth: previous month-end total unavailable:', e);
    }
    const changePercent = previousTotal && change !== null ? (change / Math.abs(previousTotal)) * 100 : null;

    const result: NetWorthSummary = {
      date: today,
      total,
      previousTotal,
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
