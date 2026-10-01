/**
 * Apply Chris's answers (A9)
 *
 * Used by POST /api/categorisation/answers — the endpoint Peter's daily
 * finance-categorise job calls with Chris's replies, and the
 * finance-recategorise skill uses instead of hand-written SQL.
 *
 * Each answer sets a category on one or more transactions (via the shared
 * manual path, so corrections are recorded). With `always`, it also makes the
 * decision stick for future transactions:
 * - row decided by a policy rule → that policy is updated to the answer
 *   (an `ask` policy becomes a `categorise` one);
 * - otherwise → a contains-rule on the merchant key is created or re-pointed
 *   at confidence 0.9.
 * Then the review queue is re-run against the updated rules.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { applyManualCategories, assertCategoriesExist, type ApplyItemResult } from './apply';
import { merchantKey, isMineablePattern } from './normalise';
import { clearRulesCache, getRules, isPolicyRule, ruleApplies, selectRule, type RuleRecord } from './rule-matcher';
import { logRuleEvents, type RuleEvent } from './rule-events';
import { recategorisePending, type RecategoriseResult } from './recategorise';

export interface Answer {
  transaction_ids: string[];
  category_id: string;
  always?: boolean;
}

export interface AlwaysRuleOutcome {
  status: 'created' | 'repointed' | 'policy_updated' | 'unchanged' | 'skipped';
  ruleId?: string;
  pattern?: string;
  /** Does the rule now win for this transaction? */
  effective?: boolean;
  reason?: string;
}

export interface AnswerResult extends Omit<ApplyItemResult, 'categoryId'> {
  index: number;
  category_id: string;
  rule?: AlwaysRuleOutcome;
}

export interface AnswersResponse {
  results: AnswerResult[];
  recategorised: RecategoriseResult | null;
}

const ALWAYS_RULE_CONFIDENCE = 0.9;
const POLICY_SOURCES = new Set(['policy', 'policy_ask']);

interface TxRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  account_id: string | null;
  engine_source: string | null;
}

async function upsertAlwaysRule(tx: TxRow, categoryId: string, now: Date): Promise<{ outcome: AlwaysRuleOutcome; event?: RuleEvent }> {
  const today = now.toISOString().slice(0, 10);
  const ctx = { description: tx.description, amount: Number(tx.amount), accountId: tx.account_id, date: tx.date };
  const rules = await getRules();

  // Row came from a policy → update that policy (Chris is overriding it).
  if (tx.engine_source && POLICY_SOURCES.has(tx.engine_source)) {
    const policy = selectRule(rules.filter(isPolicyRule), ctx);
    if (policy) {
      const rule = rules.find((r) => r.id === policy.ruleId)!;
      if (rule.category_id === categoryId && rule.action !== 'ask') {
        return { outcome: { status: 'unchanged', ruleId: rule.id, pattern: rule.pattern } };
      }
      const { error } = await supabaseAdmin
        .from('category_mappings')
        .update({
          category_id: categoryId,
          action: 'categorise',
          notes: `${rule.notes ? `${rule.notes} | ` : ''}answer:always:${today}`,
          updated_at: now.toISOString(),
        })
        .eq('id', rule.id);
      if (error) throw new Error(`Failed to update policy "${rule.pattern}": ${error.message}`);
      return {
        outcome: { status: 'policy_updated', ruleId: rule.id, pattern: rule.pattern },
        event: {
          ruleId: rule.id, pattern: rule.pattern, event: rule.category_id === categoryId ? 'updated' : 'repointed',
          oldCategoryId: rule.category_id, newCategoryId: categoryId, source: 'answers', detail: { wasAsk: rule.action === 'ask' },
        },
      };
    }
  }

  const pattern = merchantKey(tx.description);
  if (!isMineablePattern(pattern)) {
    return { outcome: { status: 'skipped', reason: `merchant "${pattern}" too generic for a rule` } };
  }

  const existing = rules.find(
    (r: RuleRecord) =>
      r.pattern.toLowerCase().trim() === pattern &&
      r.match_type === 'contains' &&
      !r.account_id && !r.amount_sign && r.amount_min == null && r.amount_max == null && !r.days_of_week?.length
  );

  if (existing) {
    if (existing.category_id === categoryId) {
      return { outcome: { status: 'unchanged', ruleId: existing.id, pattern } };
    }
    const { error } = await supabaseAdmin
      .from('category_mappings')
      .update({
        category_id: categoryId,
        confidence: Math.max(Number(existing.confidence), ALWAYS_RULE_CONFIDENCE),
        action: 'categorise',
        notes: `${existing.notes ? `${existing.notes} | ` : ''}answer:always:${today}`,
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to re-point rule "${pattern}": ${error.message}`);
    return {
      outcome: { status: 'repointed', ruleId: existing.id, pattern },
      event: { ruleId: existing.id, pattern, event: 'repointed', oldCategoryId: existing.category_id, newCategoryId: categoryId, source: 'answers' },
    };
  }

  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .insert({
      pattern,
      category_id: categoryId,
      match_type: 'contains',
      confidence: ALWAYS_RULE_CONFIDENCE,
      is_system: false,
      notes: `answer:always:${today}`,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create rule "${pattern}": ${error.message}`);
  return {
    outcome: { status: 'created', ruleId: data.id, pattern },
    event: { ruleId: data.id, pattern, event: 'created', newCategoryId: categoryId, source: 'answers' },
  };
}

/**
 * Validate (all categories must exist — otherwise nothing is written), apply,
 * make "always" answers stick, then re-run the queue.
 */
export async function applyAnswers(answers: Answer[], now: Date = new Date()): Promise<AnswersResponse> {
  await assertCategoriesExist(answers.map((a) => a.category_id));
  // Rules may have changed in another process (mining, policy sync) — never
  // decide "create vs re-point" from a stale cache.
  clearRulesCache();

  // Snapshot the first transaction of each "always" answer BEFORE applying,
  // so we still know which rule/policy decided it.
  const alwaysIds = answers.filter((a) => a.always && a.transaction_ids.length > 0).map((a) => a.transaction_ids[0]);
  const txById = new Map<string, TxRow>();
  if (alwaysIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, date, description, amount, account_id, engine_source')
      .in('id', alwaysIds);
    if (error) throw new Error(`Failed to read transactions: ${error.message}`);
    for (const r of (data ?? []) as TxRow[]) txById.set(r.id, r);
  }

  const applied = await applyManualCategories(
    answers.map((a) => ({ transactionIds: a.transaction_ids, categoryId: a.category_id }))
  );

  const results: AnswerResult[] = [];
  const events: RuleEvent[] = [];
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    const { requested, applied: appliedCount, missing, corrections } = applied[i];
    const res: AnswerResult = { index: i, category_id: a.category_id, requested, applied: appliedCount, missing, corrections };
    if (a.always) {
      const tx = txById.get(a.transaction_ids[0]);
      if (!tx) {
        res.rule = { status: 'skipped', reason: 'transaction not found' };
      } else {
        const { outcome, event } = await upsertAlwaysRule(tx, a.category_id, now);
        if (event) events.push(event);
        clearRulesCache();
        if (outcome.ruleId) {
          const rules = await getRules();
          const ctx = { description: tx.description, amount: Number(tx.amount), accountId: tx.account_id, date: tx.date };
          const winner = selectRule(rules, ctx);
          outcome.effective = winner?.categoryId === a.category_id && winner.action !== 'ask';
          // Sanity: the rule we touched does apply to the transaction.
          const touched = rules.find((r) => r.id === outcome.ruleId);
          if (touched && !ruleApplies(touched, ctx)) outcome.effective = false;
        }
        res.rule = outcome;
      }
    }
    results.push(res);
  }
  await logRuleEvents(events);

  const recategorised = events.length > 0 ? await recategorisePending() : null;
  return { results, recategorised };
}
