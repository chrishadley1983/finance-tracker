import { ebFetch } from './client';
import type { EnableBankingTransaction, TransactionsPage } from './types';

export interface FetchTransactionsOptions {
  dateFrom?: string; // YYYY-MM-DD (inclusive)
  dateTo?: string; // YYYY-MM-DD (inclusive)
  continuationKey?: string;
}

/** Fetch a single page of transactions for an account. */
export async function fetchTransactionsPage(
  accountUid: string,
  options: FetchTransactionsOptions = {},
): Promise<TransactionsPage> {
  const params = new URLSearchParams();
  if (options.dateFrom) params.set('date_from', options.dateFrom);
  if (options.dateTo) params.set('date_to', options.dateTo);
  if (options.continuationKey) params.set('continuation_key', options.continuationKey);
  const qs = params.toString();
  return ebFetch<TransactionsPage>(
    `/accounts/${encodeURIComponent(accountUid)}/transactions${qs ? `?${qs}` : ''}`,
  );
}

/**
 * Fetch all transactions for an account in a date range, following
 * continuation keys. Guarded against runaway pagination.
 */
export async function fetchAllTransactions(
  accountUid: string,
  options: Omit<FetchTransactionsOptions, 'continuationKey'> = {},
  maxPages = 200,
): Promise<EnableBankingTransaction[]> {
  const all: EnableBankingTransaction[] = [];
  let continuationKey: string | undefined;
  let pages = 0;
  do {
    const page = await fetchTransactionsPage(accountUid, { ...options, continuationKey });
    all.push(...(page.transactions ?? []));
    continuationKey = page.continuation_key;
    pages++;
    if (pages >= maxPages) {
      console.warn(`fetchAllTransactions: hit maxPages (${maxPages}) for ${accountUid}; stopping.`);
      break;
    }
  } while (continuationKey);
  return all;
}
