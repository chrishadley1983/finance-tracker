import { NextRequest, NextResponse } from 'next/server';
import type { NetWorthHistory } from '@/lib/types/fire';
import { netWorthHistory } from '@/lib/wealth/net-worth';
import { loadBalanceData, loadNetWorthAccounts } from '@/lib/wealth/load';

// =============================================================================
// GET - Net worth history over time
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    const now = new Date();
    const yearsBack = period === '1y' ? 1 : period === '2y' ? 2 : period === '5y' ? 5 : null;
    const fromMonth = yearsBack
      ? `${now.getFullYear() - yearsBack}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : null;
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Active accounts that count towards net worth (include_in_net_worth, as the monthly report does).
    const accounts = await loadNetWorthAccounts();
    if (accounts.length === 0) {
      const empty: NetWorthHistory = { snapshots: [], earliest: null, latest: null };
      return NextResponse.json(empty);
    }

    // All balance history, including points before the period: they are the starting balances.
    const { snapshots: balances, transactions } = await loadBalanceData(accounts);
    const snapshots = netWorthHistory(accounts, balances, transactions, { currentMonth, fromMonth });

    const result: NetWorthHistory = {
      snapshots,
      earliest: snapshots.length > 0 ? snapshots[0].date : null,
      latest: snapshots.length > 0 ? snapshots[snapshots.length - 1].date : null,
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Net worth history failed:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
