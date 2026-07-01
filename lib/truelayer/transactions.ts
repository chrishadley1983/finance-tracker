import { dataFetch } from './client';
import type { TrueLayerResults, TrueLayerTransaction } from './types';

function range(from?: string, to?: string): string {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Booked transactions for an account within a date range (ISO dates). */
export async function getAccountTransactions(
  accessToken: string,
  accountId: string,
  from?: string,
  to?: string,
): Promise<TrueLayerTransaction[]> {
  const res = await dataFetch<TrueLayerResults<TrueLayerTransaction>>(
    `/data/v1/accounts/${encodeURIComponent(accountId)}/transactions${range(from, to)}`,
    accessToken,
  );
  return res.results ?? [];
}

/** Booked transactions for a card within a date range. */
export async function getCardTransactions(
  accessToken: string,
  accountId: string,
  from?: string,
  to?: string,
): Promise<TrueLayerTransaction[]> {
  const res = await dataFetch<TrueLayerResults<TrueLayerTransaction>>(
    `/data/v1/cards/${encodeURIComponent(accountId)}/transactions${range(from, to)}`,
    accessToken,
  );
  return res.results ?? [];
}
