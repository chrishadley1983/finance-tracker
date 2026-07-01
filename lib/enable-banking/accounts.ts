import { ebFetch } from './client';
import type { AccountBalance, EnableBankingAccountRef } from './types';

/** Fetch account metadata (name, product, currency, iban hash, etc.). */
export async function getAccountDetails(accountUid: string): Promise<EnableBankingAccountRef> {
  return ebFetch<EnableBankingAccountRef>(`/accounts/${encodeURIComponent(accountUid)}/details`);
}

/** Fetch the current balances for an account. */
export async function getAccountBalances(accountUid: string): Promise<AccountBalance[]> {
  const res = await ebFetch<{ balances: AccountBalance[] }>(
    `/accounts/${encodeURIComponent(accountUid)}/balances`,
  );
  return res.balances ?? [];
}

/**
 * Pick the most useful "current" balance for reconciliation. Prefers the
 * closing booked balance (CLBD), then interim available (ITAV), else the first.
 */
export function pickReconcileBalance(balances: AccountBalance[]): AccountBalance | undefined {
  return (
    balances.find((b) => b.balance_type === 'CLBD') ??
    balances.find((b) => b.balance_type === 'ITAV') ??
    balances[0]
  );
}
