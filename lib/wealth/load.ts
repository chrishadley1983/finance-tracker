import { supabaseAdmin } from '@/lib/supabase/server';
import { pageAll } from '@/lib/supabase/page-all';
import { TRANSACTIONAL_TYPES, type BalancePoint, type TxPoint, type WealthAccount } from './net-worth';

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
 * investment_valuations, and the transactions of current/credit accounts.
 */
export async function loadBalanceData(accounts: WealthAccount[]): Promise<{ snapshots: BalancePoint[]; transactions: TxPoint[] }> {
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return { snapshots: [], transactions: [] };
  const snapshots = await pageAll<BalancePoint>((from, to) =>
    supabaseAdmin.from('wealth_snapshots').select('account_id, date, balance').in('account_id', ids).order('id').range(from, to),
  );
  const investmentIds = accounts.filter((a) => a.type === 'investment').map((a) => a.id);
  if (investmentIds.length > 0) {
    const valuations = await pageAll<{ account_id: string; date: string; value: number }>((from, to) =>
      supabaseAdmin.from('investment_valuations').select('account_id, date, value').in('account_id', investmentIds).order('id').range(from, to),
    );
    for (const v of valuations) snapshots.push({ account_id: v.account_id, date: v.date, balance: Number(v.value) });
  }
  const txIds = accounts.filter((a) => TRANSACTIONAL_TYPES.has(a.type)).map((a) => a.id);
  const transactions =
    txIds.length > 0
      ? await pageAll<TxPoint>((from, to) =>
          supabaseAdmin.from('transactions').select('account_id, date, amount').in('account_id', txIds).order('id').range(from, to),
        )
      : [];
  return { snapshots, transactions };
}
