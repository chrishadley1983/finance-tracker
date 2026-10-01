/**
 * Re-categorise pending rows (A8)
 *
 * After rules change (mining, Chris's "always" answers, policy sync) the
 * review queue may already be answerable. Re-run the engine — rules and
 * precedent only, no AI — over flagged, non-manual, unvalidated rows and
 * clear the ones that are now confidently categorised.
 *
 * Never touches `manual` or `is_validated = true` rows.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { categoriseMultiple, toTransactionCategoryFields } from './engine';
import { clearRulesCache } from './rule-matcher';

export interface RecategoriseResult {
  examined: number;
  changed: number;
  cleared: number;
}

interface PendingRow {
  id: string;
  date: string;
  amount: number;
  description: string;
  account_id: string;
  category_id: string | null;
  categorisation_source: string | null;
  engine_source: string | null;
  is_validated: boolean | null;
}

const PAGE = 1000;

async function fetchPending(): Promise<PendingRow[]> {
  const rows: PendingRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, date, amount, description, account_id, category_id, categorisation_source, engine_source, is_validated')
      .eq('needs_review', true)
      .order('id', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`Re-categorise: failed to read queue: ${error.message}`);
    const batch = (data ?? []) as PendingRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.filter((r) => r.categorisation_source !== 'manual' && r.is_validated !== true);
}

export async function recategorisePending(opts: { dryRun?: boolean } = {}): Promise<RecategoriseResult> {
  clearRulesCache();
  const pending = await fetchPending();
  const result: RecategoriseResult = { examined: pending.length, changed: 0, cleared: 0 };
  if (pending.length === 0) return result;

  const outcomes = await categoriseMultiple(
    pending.map((r) => ({
      date: r.date,
      description: r.description,
      amount: Number(r.amount),
      accountId: r.account_id,
    })),
    { allowAI: false }
  );

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const r = outcomes[i];
    const nowConfident = !r.needsReview && Boolean(r.categoryId);
    const newAskSuggestion =
      r.source === 'policy_ask' && (r.categoryId !== row.category_id || row.engine_source !== 'policy_ask');
    if (!nowConfident && !newAskSuggestion) continue;

    result.changed++;
    if (nowConfident) result.cleared++;
    if (opts.dryRun) continue;

    const { error } = await supabaseAdmin
      .from('transactions')
      .update(toTransactionCategoryFields(r))
      .eq('id', row.id)
      .eq('needs_review', true); // don't clobber a concurrent manual answer
    if (error) throw new Error(`Re-categorise: update failed for ${row.id}: ${error.message}`);
  }

  return result;
}
