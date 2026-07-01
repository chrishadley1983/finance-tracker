import { dataFetch } from './client';
import type { TrueLayerAccount, TrueLayerBalance, TrueLayerCard, TrueLayerResults } from './types';

/** List the consented current/savings accounts. */
export async function getAccounts(accessToken: string): Promise<TrueLayerAccount[]> {
  const res = await dataFetch<TrueLayerResults<TrueLayerAccount>>('/data/v1/accounts', accessToken);
  return res.results ?? [];
}

/** List the consented cards (credit cards). Returns [] if the scope wasn't granted. */
export async function getCards(accessToken: string): Promise<TrueLayerCard[]> {
  try {
    const res = await dataFetch<TrueLayerResults<TrueLayerCard>>('/data/v1/cards', accessToken);
    return res.results ?? [];
  } catch {
    return [];
  }
}

/** Current balance for an account. */
export async function getAccountBalance(
  accessToken: string,
  accountId: string,
): Promise<TrueLayerBalance | undefined> {
  const res = await dataFetch<TrueLayerResults<TrueLayerBalance>>(
    `/data/v1/accounts/${encodeURIComponent(accountId)}/balance`,
    accessToken,
  );
  return res.results?.[0];
}

/** Current balance for a card. */
export async function getCardBalance(
  accessToken: string,
  accountId: string,
): Promise<TrueLayerBalance | undefined> {
  const res = await dataFetch<TrueLayerResults<TrueLayerBalance>>(
    `/data/v1/cards/${encodeURIComponent(accountId)}/balance`,
    accessToken,
  );
  return res.results?.[0];
}
