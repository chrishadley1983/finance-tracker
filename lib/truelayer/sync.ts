/**
 * Server-side TrueLayer sync: refresh the access token, fetch transactions for
 * a linked account, reconcile against the ledger and insert only what's
 * missing. INSERT-ONLY — never updates existing rows (preserves user edits).
 * Reuses the provider-agnostic reconcile engine from lib/bank-sync.
 *
 * NOTE: not marked `server-only` so it can also be driven from a local Node
 * script (scripts/sync-truelayer.ts) for scheduled syncs without the Vercel
 * 60s function limit. It is never imported by client code (the lib/truelayer
 * barrel deliberately excludes it; only API routes + the local script import it).
 */
import { supabaseAdmin } from '@/lib/supabase/server';
import { pageAll } from '@/lib/supabase/page-all';
import {
  categoriseMultiple,
  toTransactionCategoryFields,
  type CategorisationResult,
} from '@/lib/categorisation';
import {
  planReconcile,
  type ExistingDbRow,
  type MappedBankTransaction,
} from '@/lib/bank-sync/reconcile';
import { refreshAccessToken } from './client';
import { getAccountBalance, getCardBalance } from './accounts';
import { getAccountTransactions, getCardTransactions } from './transactions';
import { mapTrueLayerTransaction } from './reconcile-map';
import { TrueLayerError } from './types';

const DEFAULT_LOOKBACK_DAYS = 730;
const RESYNC_OVERLAP_DAYS = 7;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SyncAccountResult {
  accountId: string;
  accountName: string;
  imported: number;
  alreadyPresent: number;
  fetched: number;
  dateRange: { from: string; to: string };
  balance: { available: number; current: number; currency: string } | null;
  error?: string;
}

interface AccountRow {
  id: string;
  name: string;
  type: string;
  truelayer_account_id: string | null;
  truelayer_connection_id: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
}

/** Return a valid access token for a connection, refreshing + persisting if needed. */
async function getValidAccessToken(connectionId: string): Promise<string> {
  const { data: conn, error } = await supabaseAdmin
    .from('truelayer_connections')
    .select('id, status, access_token, refresh_token, token_expires_at')
    .eq('id', connectionId)
    .single();
  if (error || !conn) throw new TrueLayerError('Bank connection not found', 400, 'NO_CONNECTION');
  if (conn.status !== 'active') {
    throw new TrueLayerError('Bank connection is not active — please reconnect', 401, 'RECONSENT');
  }

  const now = Date.now();
  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (conn.access_token && exp - 60_000 > now) return conn.access_token;

  if (!conn.refresh_token) {
    throw new TrueLayerError('Consent expired — please reconnect the account', 401, 'RECONSENT');
  }
  try {
    const tokens = await refreshAccessToken(conn.refresh_token);
    const newExp = new Date(now + tokens.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from('truelayer_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? conn.refresh_token,
        token_expires_at: newExp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);
    return tokens.access_token;
  } catch {
    // Refresh tokens expire (~90 days) — mark the connection so the UI prompts re-consent.
    await supabaseAdmin.from('truelayer_connections').update({ status: 'expired' }).eq('id', connectionId);
    throw new TrueLayerError('Consent expired — please reconnect the account', 401, 'RECONSENT');
  }
}

/** Sync a single linked account. */
export async function syncAccount(
  financeAccountId: string,
  opts: { dateFrom?: string; dateTo?: string; dateToleranceDays?: number; now?: Date } = {},
): Promise<SyncAccountResult> {
  const now = opts.now ?? new Date();

  const { data: account, error: accErr } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, truelayer_account_id, truelayer_connection_id, sync_enabled, last_sync_at')
    .eq('id', financeAccountId)
    .single<AccountRow>();
  if (accErr || !account) throw new TrueLayerError('Account not found', 404, 'NO_ACCOUNT');
  if (!account.truelayer_account_id || !account.truelayer_connection_id) {
    throw new TrueLayerError('Account is not linked to TrueLayer', 400, 'NOT_LINKED');
  }

  const accessToken = await getValidAccessToken(account.truelayer_connection_id);
  const isCard = account.type === 'credit';

  const dateTo = opts.dateTo ?? isoDate(now);
  let dateFrom = opts.dateFrom;
  if (!dateFrom) {
    const from = new Date(now);
    from.setDate(from.getDate() - (account.last_sync_at ? RESYNC_OVERLAP_DAYS + 7 : DEFAULT_LOOKBACK_DAYS));
    dateFrom = account.last_sync_at
      ? isoDate(new Date(new Date(account.last_sync_at).getTime() - RESYNC_OVERLAP_DAYS * 86_400_000))
      : isoDate(from);
  }

  // 1. Fetch from TrueLayer.
  const raw = isCard
    ? await getCardTransactions(accessToken, account.truelayer_account_id, dateFrom, dateTo)
    : await getAccountTransactions(accessToken, account.truelayer_account_id, dateFrom, dateTo);
  const mapped: MappedBankTransaction[] = raw
    .map(mapTrueLayerTransaction)
    .filter((t): t is MappedBankTransaction => t !== null);

  // 2. Existing DB rows over the span.
  let minDate = dateFrom;
  let maxDate = dateTo;
  for (const t of mapped) {
    if (t.date < minDate) minDate = t.date;
    if (t.date > maxDate) maxDate = t.date;
  }
  // Widen by the reconcile's date tolerance so a CSV row just outside the window can still match
  // (pass 2 matches amount within ±tolerance days), and page past Supabase's 1,000-row cap: a truncated
  // read makes planReconcile treat unseen rows as missing (unique-ref errors, or duplicates of CSV rows).
  const tolerance = opts.dateToleranceDays ?? 3;
  const shift = (d: string, days: number) => isoDate(new Date(new Date(`${d}T00:00:00Z`).getTime() + days * 86_400_000));
  let existingRows: Array<{ id: string; date: string; amount: number; hsbc_transaction_id: string | null }>;
  try {
    existingRows = await pageAll((from, to) =>
      supabaseAdmin
        .from('transactions')
        .select('id, date, amount, hsbc_transaction_id')
        .eq('account_id', financeAccountId)
        .gte('date', shift(minDate, -tolerance))
        .lte('date', shift(maxDate, tolerance))
        .order('id')
        .range(from, to),
    );
  } catch (e) {
    throw new TrueLayerError(`Failed to read transactions: ${e instanceof Error ? e.message : String(e)}`, 500, 'DB');
  }
  // The ±tolerance margin exists for CSV/manual rows whose booking date sits just outside the window.
  // Bank-referenced rows in the margin belong to transactions outside this fetch: offering them to the
  // amount/date pass could absorb a genuinely new same-amount transaction, so keep them out.
  const inMargin = (d: string) => d < minDate || d > maxDate;
  const existing: ExistingDbRow[] = existingRows.filter((r) => !(inMargin(r.date) && r.hsbc_transaction_id)).map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    ref: r.hsbc_transaction_id,
  }));

  // 3. Plan (pure, insert-only).
  const plan = planReconcile(mapped, existing, { dateToleranceDays: opts.dateToleranceDays });

  // 4. Auto-categorise new rows.
  let categorised: CategorisationResult[] = [];
  if (plan.toInsert.length > 0) {
    categorised = await categoriseMultiple(
      plan.toInsert.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        accountId: financeAccountId,
      })),
    );
  }

  // 5. Insert (batched); hsbc_transaction_id carries the TrueLayer reference.
  let imported = 0;
  if (plan.toInsert.length > 0) {
    const rows = plan.toInsert.map((t, i) => ({
      account_id: financeAccountId,
      date: t.date,
      amount: t.amount,
      description: t.description,
      hsbc_transaction_id: t.entryReference ?? null,
      // Category, sources, confidence and the review flag come from the engine
      // (low confidence, ask-policies and new-merchant AI guesses are flagged).
      ...(categorised[i]
        ? toTransactionCategoryFields(categorised[i])
        : {
            category_id: null,
            categorisation_source: 'import' as const,
            engine_source: 'none',
            categorisation_confidence: null,
            needs_review: true,
          }),
    }));
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error: insErr, count } = await supabaseAdmin
        .from('transactions')
        .insert(slice, { count: 'exact' });
      if (insErr) throw new TrueLayerError(`Insert failed: ${insErr.message}`, 500, 'DB_INSERT');
      imported += count ?? slice.length;
    }
  }

  // 6. Watermark.
  await supabaseAdmin.from('accounts').update({ last_sync_at: now.toISOString() }).eq('id', financeAccountId);

  // 7. Balance (informational).
  let balance: SyncAccountResult['balance'] = null;
  try {
    const b = isCard
      ? await getCardBalance(accessToken, account.truelayer_account_id)
      : await getAccountBalance(accessToken, account.truelayer_account_id);
    if (b) balance = { available: b.available, current: b.current, currency: b.currency };
  } catch {
    /* non-critical */
  }

  return {
    accountId: financeAccountId,
    accountName: account.name,
    imported,
    alreadyPresent: plan.summary.alreadyPresent,
    fetched: mapped.length,
    dateRange: { from: dateFrom, to: dateTo },
    balance,
  };
}

/** Sync every account with sync_enabled + a linked TrueLayer account. */
export async function syncAllEnabledAccounts(
  opts: { dateFrom?: string; dateTo?: string; now?: Date } = {},
): Promise<SyncAccountResult[]> {
  const { data: accounts, error } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('sync_enabled', true)
    .not('truelayer_account_id', 'is', null);
  if (error) throw new TrueLayerError(`Failed to list accounts: ${error.message}`, 500, 'DB');

  const results: SyncAccountResult[] = [];
  for (const a of accounts ?? []) {
    try {
      results.push(await syncAccount(a.id, opts));
    } catch (e) {
      results.push({
        accountId: a.id,
        accountName: '',
        imported: 0,
        alreadyPresent: 0,
        fetched: 0,
        dateRange: { from: opts.dateFrom ?? '', to: opts.dateTo ?? '' },
        balance: null,
        error: e instanceof TrueLayerError ? e.message : 'Sync failed',
      });
    }
  }
  return results;
}
