import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to add no-cache headers
function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

type AccountTypeLabel = 'ISAs' | 'Pensions' | 'Investments' | 'Property' | 'Savings' | 'Current' | 'Credit' | 'Other';

const TYPE_LABELS: Record<string, AccountTypeLabel> = {
  isa: 'ISAs',
  pension: 'Pensions',
  investment: 'Investments',
  property: 'Property',
  savings: 'Savings',
  current: 'Current',
  credit: 'Credit',
  other: 'Other',
};

const TYPE_ORDER: AccountTypeLabel[] = ['Pensions', 'ISAs', 'Investments', 'Property', 'Savings', 'Current', 'Credit', 'Other'];

export async function GET() {
  try {
    // Get all active accounts that should be included in net worth
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, type, include_in_net_worth')
      .or('is_archived.eq.false,is_archived.is.null')
      .or('include_in_net_worth.eq.true,include_in_net_worth.is.null');

    if (accountsError) {
      return jsonResponse({ error: accountsError.message }, 500);
    }

    const accountIds = accounts?.map(a => a.id) || [];

    // Get transaction balances using RPC
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

    const { data: snapshotBalances } = await supabaseAdmin
      .rpc('get_account_balances_with_snapshots', { account_ids: accountIds }) as { data: SnapshotBalanceRow[] | null; error: Error | null };

    const snapshotByAccount = new Map<string, { balance: number; currentBalance: number }>();
    for (const s of snapshotBalances || []) {
      snapshotByAccount.set(s.account_id, {
        balance: s.snapshot_balance,
        currentBalance: s.current_balance,
      });
    }

    // Get latest investment valuations
    const investmentAccountIds = accounts
      ?.filter(a => ['investment', 'pension', 'isa'].includes(a.type))
      .map(a => a.id) || [];

    const { data: valuations } = await supabaseAdmin
      .from('investment_valuations')
      .select('account_id, value')
      .in('account_id', investmentAccountIds)
      .order('date', { ascending: false });

    const valuationByAccount = new Map<string, number>();
    for (const v of valuations || []) {
      if (!valuationByAccount.has(v.account_id)) {
        valuationByAccount.set(v.account_id, v.value);
      }
    }

    // Calculate balances by account type
    const balancesByType = new Map<string, number>();
    let totalNetWorth = 0;

    for (const account of accounts || []) {
      const isInvestmentType = ['investment', 'pension', 'isa'].includes(account.type);
      let balance = 0;

      if (isInvestmentType) {
        if (valuationByAccount.has(account.id)) {
          balance = valuationByAccount.get(account.id)!;
        } else if (snapshotByAccount.has(account.id)) {
          // Investment accounts: use snapshot balance only (not combined with transactions)
          balance = snapshotByAccount.get(account.id)!.balance;
        } else if (txBalanceByAccount.has(account.id)) {
          balance = txBalanceByAccount.get(account.id)!;
        }
      } else {
        if (snapshotByAccount.has(account.id)) {
          // Non-investment accounts: use snapshot + transactions from snapshot date
          balance = snapshotByAccount.get(account.id)!.currentBalance;
        } else if (txBalanceByAccount.has(account.id)) {
          balance = txBalanceByAccount.get(account.id)!;
        }
      }

      totalNetWorth += balance;
      balancesByType.set(
        account.type,
        (balancesByType.get(account.type) || 0) + balance
      );
    }

    // Build response with labeled types in order
    const accountTypeBalances = TYPE_ORDER
      .filter(label => {
        const type = Object.entries(TYPE_LABELS).find(([, l]) => l === label)?.[0];
        return type && balancesByType.has(type);
      })
      .map(label => {
        const type = Object.entries(TYPE_LABELS).find(([, l]) => l === label)![0];
        return {
          type,
          label,
          balance: Math.round((balancesByType.get(type) || 0) * 100) / 100,
        };
      });

    return jsonResponse({
      netWorth: Math.round(totalNetWorth * 100) / 100,
      accountTypeBalances,
    });
  } catch (error) {
    console.error('Error fetching account summary:', error);
    return jsonResponse({ error: 'Failed to fetch account summary' }, 500);
  }
}
