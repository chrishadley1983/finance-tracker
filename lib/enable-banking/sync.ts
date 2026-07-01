/**
 * Server-side sync orchestration: fetch EB transactions for a linked account,
 * reconcile against the ledger, auto-categorise and insert only what's missing.
 * INSERT-ONLY — never updates existing rows (preserves user renames/categories).
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/server';
import { categoriseMultiple, CONFIDENCE_REVIEW_THRESHOLD } from '@/lib/categorisation';
import { getAccountBalances, pickReconcileBalance } from './accounts';
import { fetchAllTransactions } from './transactions';
import {
  mapEbTransaction,
  planReconcile,
  type ExistingDbRow,
  type MappedEbTransaction,
} from './reconcile';
import { EnableBankingError } from './types';

type DbCategorisationSource = 'manual' | 'rule' | 'ai' | 'import';

/** Map the categorisation engine's source to the DB enum (mirrors CSV import). */
function mapCategorisationSource(source: string): DbCategorisationSource {
  switch (source) {
    case 'rule_exact':
    case 'rule_pattern':
    case 'similar':
      return 'rule';
    case 'ai':
      return 'ai';
    default:
      return 'import';
  }
}

const DEFAULT_LOOKBACK_DAYS = 730; // first sync / no prior watermark
const RESYNC_OVERLAP_DAYS = 7; // re-scan a week back to catch late-booked items

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SyncAccountResult {
  accountId: string;
  accountName: string;
  imported: number;
  alreadyPresent: number;
  pendingSkipped: number;
  fetched: number;
  dateRange: { from: string; to: string };
  ebBalance: { amount: number; currency: string; type: string } | null;
  error?: string;
}

interface AccountRow {
  id: string;
  name: string;
  enable_banking_account_uid: string | null;
  enable_banking_session_id: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
}

/** Verify the account's consent session is still valid; throws if not. */
async function assertSessionValid(sessionRowId: string | null): Promise<void> {
  if (!sessionRowId) {
    throw new EnableBankingError('Account is not linked to a bank session', 400, 'NOT_LINKED');
  }
  const { data, error } = await supabaseAdmin
    .from('enable_banking_sessions')
    .select('valid_until, status')
    .eq('id', sessionRowId)
    .single();
  if (error || !data) {
    throw new EnableBankingError('Bank session not found', 400, 'NO_SESSION');
  }
  if (data.status !== 'active' || new Date(data.valid_until) <= new Date()) {
    throw new EnableBankingError('Bank consent has expired — please re-link the account', 401, 'CONSENT_EXPIRED');
  }
}

/** Sync a single linked account. `now` is injectable for testing. */
export async function syncAccount(
  accountId: string,
  opts: { dateFrom?: string; dateTo?: string; dateToleranceDays?: number; now?: Date } = {},
): Promise<SyncAccountResult> {
  const now = opts.now ?? new Date();

  const { data: account, error: accErr } = await supabaseAdmin
    .from('accounts')
    .select('id, name, enable_banking_account_uid, enable_banking_session_id, sync_enabled, last_sync_at')
    .eq('id', accountId)
    .single<AccountRow>();
  if (accErr || !account) {
    throw new EnableBankingError('Account not found', 404, 'NO_ACCOUNT');
  }
  if (!account.enable_banking_account_uid) {
    throw new EnableBankingError('Account is not linked to Enable Banking', 400, 'NOT_LINKED');
  }
  await assertSessionValid(account.enable_banking_session_id);

  const dateTo = opts.dateTo ?? isoDate(now);
  let dateFrom = opts.dateFrom;
  if (!dateFrom) {
    if (account.last_sync_at) {
      const from = new Date(account.last_sync_at);
      from.setDate(from.getDate() - RESYNC_OVERLAP_DAYS);
      dateFrom = isoDate(from);
    } else {
      const from = new Date(now);
      from.setDate(from.getDate() - DEFAULT_LOOKBACK_DAYS);
      dateFrom = isoDate(from);
    }
  }

  // 1. Fetch from the bank.
  const ebTxns = await fetchAllTransactions(account.enable_banking_account_uid, {
    dateFrom,
    dateTo,
  });
  const mapped: MappedEbTransaction[] = ebTxns
    .map(mapEbTransaction)
    .filter((t): t is MappedEbTransaction => t !== null);

  // 2. Load existing DB rows across the mapped date span.
  let minDate = dateFrom;
  let maxDate = dateTo;
  for (const t of mapped) {
    if (t.date < minDate) minDate = t.date;
    if (t.date > maxDate) maxDate = t.date;
  }
  const { data: existingRows, error: exErr } = await supabaseAdmin
    .from('transactions')
    .select('id, date, amount, hsbc_transaction_id')
    .eq('account_id', accountId)
    .gte('date', minDate)
    .lte('date', maxDate);
  if (exErr) {
    throw new EnableBankingError(`Failed to read existing transactions: ${exErr.message}`, 500, 'DB');
  }
  const existing: ExistingDbRow[] = (existingRows ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    amount: Number(r.amount),
    ref: r.hsbc_transaction_id,
  }));

  // 3. Plan (pure).
  const plan = planReconcile(mapped, existing, { dateToleranceDays: opts.dateToleranceDays });

  // 4. Auto-categorise the rows we're about to insert.
  let categorised: Array<{ categoryId: string | null; source: string; confidence: number }> = [];
  if (plan.toInsert.length > 0) {
    const results = await categoriseMultiple(
      plan.toInsert.map((t) => ({ date: t.date, description: t.description, amount: t.amount })),
    );
    categorised = results.map((r) => ({
      categoryId: r.categoryId,
      source: r.source,
      confidence: r.confidence,
    }));
  }

  // 5. Insert (batched). hsbc_transaction_id carries the EB entry_reference for
  //    stable, rename-safe dedup on the next sync.
  let imported = 0;
  if (plan.toInsert.length > 0) {
    const rows = plan.toInsert.map((t, i) => {
      const cat = categorised[i] ?? { categoryId: null, source: 'none', confidence: 0 };
      return {
        account_id: accountId,
        date: t.date,
        amount: t.amount,
        description: t.description,
        category_id: cat.categoryId,
        categorisation_source: mapCategorisationSource(cat.source),
        engine_source: cat.source,
        categorisation_confidence: cat.categoryId ? cat.confidence : null,
        hsbc_transaction_id: t.entryReference ?? null,
        // Low-confidence guesses are applied best-effort but must be reviewed.
        needs_review: !cat.categoryId || cat.confidence < CONFIDENCE_REVIEW_THRESHOLD,
      };
    });
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error: insErr, count } = await supabaseAdmin
        .from('transactions')
        .insert(rows.slice(i, i + CHUNK), { count: 'exact' });
      if (insErr) {
        throw new EnableBankingError(`Insert failed: ${insErr.message}`, 500, 'DB_INSERT');
      }
      imported += count ?? rows.slice(i, i + CHUNK).length;
    }
  }

  // 6. Watermark.
  await supabaseAdmin.from('accounts').update({ last_sync_at: now.toISOString() }).eq('id', accountId);

  // 7. Best-effort balance snapshot (informational).
  let ebBalance: SyncAccountResult['ebBalance'] = null;
  try {
    const balances = await getAccountBalances(account.enable_banking_account_uid);
    const b = pickReconcileBalance(balances);
    if (b) {
      ebBalance = {
        amount: Number(b.balance_amount.amount),
        currency: b.balance_amount.currency,
        type: b.balance_type,
      };
    }
  } catch {
    /* balances are non-critical */
  }

  return {
    accountId,
    accountName: account.name,
    imported,
    alreadyPresent: plan.summary.alreadyPresent,
    pendingSkipped: plan.pendingSkipped,
    fetched: mapped.length,
    dateRange: { from: dateFrom, to: dateTo },
    ebBalance,
  };
}

/** Sync every account with sync_enabled + a linked EB account uid. */
export async function syncAllEnabledAccounts(
  opts: { dateFrom?: string; dateTo?: string; now?: Date } = {},
): Promise<SyncAccountResult[]> {
  const { data: accounts, error } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('sync_enabled', true)
    .not('enable_banking_account_uid', 'is', null);
  if (error) {
    throw new EnableBankingError(`Failed to list sync-enabled accounts: ${error.message}`, 500, 'DB');
  }
  const results: SyncAccountResult[] = [];
  for (const a of accounts ?? []) {
    try {
      results.push(await syncAccount(a.id, opts));
    } catch (e) {
      const err = e instanceof EnableBankingError ? e.message : 'Sync failed';
      results.push({
        accountId: a.id,
        accountName: '',
        imported: 0,
        alreadyPresent: 0,
        pendingSkipped: 0,
        fetched: 0,
        dateRange: { from: opts.dateFrom ?? '', to: opts.dateTo ?? '' },
        ebBalance: null,
        error: err,
      });
    }
  }
  return results;
}
