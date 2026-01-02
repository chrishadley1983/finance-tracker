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

    // Get latest valuations for investment accounts
    const investmentAccounts = accounts.filter((a: { type: string }) => a.type === 'investment');
    const investmentAccountIds = investmentAccounts.map((a: { id: string }) => a.id);

    let investmentValuations = new Map<string, number>();
    if (investmentAccountIds.length > 0) {
      const { data: valuations } = await supabaseAdmin
        .from('investment_valuations')
        .select('account_id, value, date')
        .in('account_id', investmentAccountIds)
        .order('date', { ascending: false });

      // Get latest per account
      for (const v of valuations || []) {
        if (!investmentValuations.has(v.account_id)) {
          investmentValuations.set(v.account_id, v.value);
        }
      }
    }

    // Get latest wealth snapshots for other accounts
    const otherAccountIds = accounts
      .filter((a: { type: string }) => a.type !== 'investment')
      .map((a: { id: string }) => a.id);

    let wealthSnapshots = new Map<string, number>();
    if (otherAccountIds.length > 0) {
      const { data: snapshots } = await supabaseAdmin
        .from('wealth_snapshots')
        .select('account_id, balance, date')
        .in('account_id', otherAccountIds)
        .order('date', { ascending: false });

      for (const s of snapshots || []) {
        if (!wealthSnapshots.has(s.account_id)) {
          wealthSnapshots.set(s.account_id, s.balance);
        }
      }
    }

    // Calculate balances for current accounts from transactions
    const currentSavingsAccounts = accounts.filter(
      (a: { type: string }) => a.type === 'current' || a.type === 'savings'
    );
    let transactionBalances = new Map<string, number>();

    for (const account of currentSavingsAccounts) {
      // Use wealth snapshot if available, otherwise calculate from transactions
      if (wealthSnapshots.has(account.id)) {
        transactionBalances.set(account.id, wealthSnapshots.get(account.id)!);
      } else {
        // Sum all transactions for this account
        const { data: txSum } = await supabaseAdmin
          .from('transactions')
          .select('amount')
          .eq('account_id', account.id);

        const balance = (txSum || []).reduce(
          (sum: number, tx: { amount: number }) => sum + tx.amount,
          0
        );
        transactionBalances.set(account.id, balance);
      }
    }

    // Build account balances
    const byAccount: NetWorthSummary['byAccount'] = [];
    const typeBalances = new Map<string, number>();

    for (const account of accounts) {
      let balance = 0;

      if (account.type === 'investment') {
        balance = investmentValuations.get(account.id) || 0;
      } else if (transactionBalances.has(account.id)) {
        balance = transactionBalances.get(account.id)!;
      } else if (wealthSnapshots.has(account.id)) {
        balance = wealthSnapshots.get(account.id)!;
      }

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

    // Get previous investment valuations
    let previousInvestmentTotal = 0;
    if (investmentAccountIds.length > 0) {
      const { data: prevValuations } = await supabaseAdmin
        .from('investment_valuations')
        .select('account_id, value')
        .in('account_id', investmentAccountIds)
        .lte('date', lastMonthStr)
        .order('date', { ascending: false });

      const prevInvMap = new Map<string, number>();
      for (const v of prevValuations || []) {
        if (!prevInvMap.has(v.account_id)) {
          prevInvMap.set(v.account_id, v.value);
        }
      }
      previousInvestmentTotal = Array.from(prevInvMap.values()).reduce((a, b) => a + b, 0);
    }

    // Get previous wealth snapshots
    let previousSnapshotTotal = 0;
    if (otherAccountIds.length > 0) {
      const { data: prevSnapshots } = await supabaseAdmin
        .from('wealth_snapshots')
        .select('account_id, balance')
        .in('account_id', otherAccountIds)
        .lte('date', lastMonthStr)
        .order('date', { ascending: false });

      const prevSnapMap = new Map<string, number>();
      for (const s of prevSnapshots || []) {
        if (!prevSnapMap.has(s.account_id)) {
          prevSnapMap.set(s.account_id, s.balance);
        }
      }
      previousSnapshotTotal = Array.from(prevSnapMap.values()).reduce((a, b) => a + b, 0);
    }

    const previousTotal = previousInvestmentTotal + previousSnapshotTotal;
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
