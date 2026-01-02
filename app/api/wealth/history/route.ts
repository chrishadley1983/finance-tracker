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

    const investmentAccountIds = accounts
      .filter((a: { type: string }) => a.type === 'investment')
      .map((a: { id: string }) => a.id);

    const otherAccountIds = accounts
      .filter((a: { type: string }) => a.type !== 'investment')
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
