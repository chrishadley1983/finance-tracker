import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ACCOUNT_TYPE_LABELS, type NetWorthHistory, type NetWorthHistoryPoint } from '@/lib/types/fire';

// =============================================================================
// GET - Net worth history over time
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    // Calculate date range
    let fromDate: Date | null = null;
    const now = new Date();

    switch (period) {
      case '1y':
        fromDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case '2y':
        fromDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
        break;
      case '5y':
        fromDate = new Date(now.getFullYear() - 5, now.getMonth(), 1);
        break;
      case 'all':
      default:
        fromDate = null;
    }

    const fromDateStr = fromDate ? fromDate.toISOString().split('T')[0] : null;

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type')
      .eq('is_active', true);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      const emptyResult: NetWorthHistory = {
        snapshots: [],
        earliest: null,
        latest: null,
      };
      return NextResponse.json(emptyResult);
    }

    // Build account type map
    const accountTypeMap = new Map<string, string>();
    for (const a of accounts) {
      accountTypeMap.set(a.id, a.type);
    }

    // Transactional account types are tracked via snapshot + subsequent
    // transactions (matching the dashboard's get_account_balances_with_snapshots
    // RPC). Reading raw snapshots alone leaves these stuck on whatever the seed
    // value was — e.g. HSBC Joint Current got one snapshot in Feb and the
    // chart was carrying that forward to May.
    const TRANSACTIONAL_TYPES = new Set(['current', 'credit']);

    const investmentAccountIds = accounts
      .filter((a: { type: string }) => a.type === 'investment')
      .map((a: { id: string }) => a.id);

    const transactionalAccounts = accounts.filter(
      (a: { type: string }) => TRANSACTIONAL_TYPES.has(a.type),
    );
    const transactionalAccountIds = transactionalAccounts.map((a: { id: string }) => a.id);

    // wealth_snapshots-driven accounts: not investment, not transactional
    const otherAccountIds = accounts
      .filter(
        (a: { type: string }) =>
          a.type !== 'investment' && !TRANSACTIONAL_TYPES.has(a.type),
      )
      .map((a: { id: string }) => a.id);

    // Get investment valuations
    let investmentQuery = supabaseAdmin
      .from('investment_valuations')
      .select('account_id, date, value')
      .in('account_id', investmentAccountIds)
      .order('date', { ascending: true });

    if (fromDateStr) {
      investmentQuery = investmentQuery.gte('date', fromDateStr);
    }

    const { data: investmentValuations } = investmentAccountIds.length > 0
      ? await investmentQuery
      : { data: [] };

    // Get wealth snapshots
    let snapshotQuery = supabaseAdmin
      .from('wealth_snapshots')
      .select('account_id, date, balance')
      .in('account_id', otherAccountIds)
      .order('date', { ascending: true });

    if (fromDateStr) {
      snapshotQuery = snapshotQuery.gte('date', fromDateStr);
    }

    const { data: wealthSnapshots } = otherAccountIds.length > 0
      ? await snapshotQuery
      : { data: [] };

    // Combine all data points by month
    const monthlyData = new Map<string, Map<string, number>>();

    // Process investment valuations
    for (const v of investmentValuations || []) {
      const monthKey = v.date.substring(0, 7); // YYYY-MM
      const accountType = accountTypeMap.get(v.account_id) || 'investment';

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, new Map<string, number>());
      }

      const monthData = monthlyData.get(monthKey)!;
      const currentVal = monthData.get(accountType) || 0;
      monthData.set(accountType, currentVal + v.value);
    }

    // Process wealth snapshots
    for (const s of wealthSnapshots || []) {
      const monthKey = s.date.substring(0, 7);
      const accountType = accountTypeMap.get(s.account_id) || 'other';

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, new Map<string, number>());
      }

      const monthData = monthlyData.get(monthKey)!;
      const currentVal = monthData.get(accountType) || 0;
      monthData.set(accountType, currentVal + s.balance);
    }

    // Transactional accounts: compute end-of-month balance as
    // latest_snapshot_balance + sum(transactions where snapshot.date < tx.date <= month_end).
    if (transactionalAccountIds.length > 0) {
      const { data: txSnapshots } = await supabaseAdmin
        .from('wealth_snapshots')
        .select('account_id, date, balance')
        .in('account_id', transactionalAccountIds)
        .order('date', { ascending: true });

      // All snapshots per account, sorted asc
      const snapshotsByAccount = new Map<string, { date: string; balance: number }[]>();
      for (const s of txSnapshots || []) {
        const arr = snapshotsByAccount.get(s.account_id) || [];
        arr.push({ date: s.date, balance: Number(s.balance) });
        snapshotsByAccount.set(s.account_id, arr);
      }

      // All transactions per account
      const txsByAccount = new Map<string, { date: string; amount: number }[]>();
      let txFrom = 0;
      const txPageSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page } = await supabaseAdmin
          .from('transactions')
          .select('account_id, date, amount')
          .in('account_id', transactionalAccountIds)
          .range(txFrom, txFrom + txPageSize - 1);
        if (!page || page.length === 0) break;
        for (const t of page) {
          const arr = txsByAccount.get(t.account_id) || [];
          arr.push({ date: t.date, amount: Number(t.amount) });
          txsByAccount.set(t.account_id, arr);
        }
        if (page.length < txPageSize) break;
        txFrom += txPageSize;
      }

      // Months to compute for: every month already in monthlyData (so the
      // chart shows transactional balances on every existing point), plus
      // the current month so today's value is reflected.
      const monthKeySet = new Set(monthlyData.keys());
      monthKeySet.add(new Date().toISOString().substring(0, 7));
      const monthKeys = Array.from(monthKeySet);

      for (const account of transactionalAccounts) {
        const accountSnapshots = snapshotsByAccount.get(account.id) || [];
        if (accountSnapshots.length === 0) continue;
        const accountTxs = txsByAccount.get(account.id) || [];
        const earliestSnapshotDate = accountSnapshots[0].date;

        for (const monthKey of monthKeys) {
          const [yr, mo] = monthKey.split('-').map(Number);
          const lastDay = new Date(yr, mo, 0).getDate();
          const monthEndStr = `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

          // No data possible before the first snapshot
          if (monthEndStr < earliestSnapshotDate) continue;

          // Latest snapshot at or before month-end
          let baseline = accountSnapshots[0];
          for (const s of accountSnapshots) {
            if (s.date <= monthEndStr) baseline = s;
            else break;
          }

          // Sum transactions strictly after baseline date and at-or-before month-end
          let balance = baseline.balance;
          for (const tx of accountTxs) {
            if (tx.date > baseline.date && tx.date <= monthEndStr) {
              balance += tx.amount;
            }
          }

          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, new Map<string, number>());
          }
          const monthData = monthlyData.get(monthKey)!;
          const currentVal = monthData.get(account.type) || 0;
          monthData.set(account.type, currentVal + balance);
        }
      }
    }

    // Convert to array format
    const snapshots: NetWorthHistoryPoint[] = [];
    const sortedMonths = Array.from(monthlyData.keys()).sort();

    // Carry forward values for months with partial data
    const lastKnownValues = new Map<string, number>();

    for (const monthKey of sortedMonths) {
      const monthData = monthlyData.get(monthKey)!;

      // Update last known values
      Array.from(monthData.entries()).forEach(([type, value]) => {
        lastKnownValues.set(type, value);
      });

      // Build byType with carried forward values
      const byType: Record<string, number> = {};
      let total = 0;

      Array.from(lastKnownValues.entries()).forEach(([type, value]) => {
        byType[type] = value;
        total += value;
      });

      snapshots.push({
        date: `${monthKey}-01`,
        total,
        byType,
      });
    }

    const result: NetWorthHistory = {
      snapshots,
      earliest: snapshots.length > 0 ? snapshots[0].date : null,
      latest: snapshots.length > 0 ? snapshots[snapshots.length - 1].date : null,
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
