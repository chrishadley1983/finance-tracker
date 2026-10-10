import { supabaseAdmin } from '@/lib/supabase/server';
import { pageAll } from '@/lib/supabase/page-all';
import type { BalancePoint, TxPoint, WealthAccount } from './net-worth';

/** Accounts that count towards net worth: active AND include_in_net_worth (as the monthly report uses). */
export async function loadNetWorthAccounts(): Promise<Array<WealthAccount & { name: string }>> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type')
    .eq('is_active', true)
    .eq('include_in_net_worth', true);
  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`);
  return data ?? [];
}

/**
 * Every balance point for the accounts (paged past the 1,000-row cap): wealth_snapshots for all
 * types (the monthly balance form writes investment balances there too), plus any legacy
 * investment_valuations, and the accounts' transactions. `upTo` (YYYY-MM-DD) bounds both when only
 * a past date is being valued.
 */
export async function loadBalanceData(
  accounts: WealthAccount[],
  opts: { upTo?: string } = {},
): Promise<{ snapshots: BalancePoint[]; transactions: TxPoint[] }> {
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return { snapshots: [], transactions: [] };
  const upTo = opts.upTo ?? '9999-12-31';
  const snapshots = await pageAll<BalancePoint>((from, to) =>
    supabaseAdmin.from('wealth_snapshots').select('account_id, date, balance').in('account_id', ids).lte('date', upTo).order('id').range(from, to),
  );
  const investmentIds = accounts.filter((a) => a.type === 'investment').map((a) => a.id);
  if (investmentIds.length > 0) {
    const valuations = await pageAll<{ account_id: string; date: string; value: number }>((from, to) =>
      supabaseAdmin.from('investment_valuations').select('account_id, date, value').in('account_id', investmentIds).lte('date', upTo).order('id').range(from, to),
    );
    for (const v of valuations) snapshots.push({ account_id: v.account_id, date: v.date, balance: Number(v.value) });
  }
  // Only accounts with a snapshot can be valued, so only their transactions are needed.
  const valued = Array.from(new Set(snapshots.map((s) => s.account_id)));
  const transactions =
    valued.length > 0
      ? await pageAll<TxPoint>((from, to) =>
          supabaseAdmin.from('transactions').select('account_id, date, amount').in('account_id', valued).lte('date', upTo).order('id').range(from, to),
        )
      : [];
  return { snapshots, transactions };
}
