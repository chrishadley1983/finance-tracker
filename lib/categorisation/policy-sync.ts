/**
 * Upsert POLICIES (lib/categorisation/policies.ts) into category_mappings.
 *
 * A policy row is identified by pattern + match_type + conditions (the same
 * key as the uq_category_mappings_pattern_conditions index). Existing rows
 * are updated in place (category, action, confidence, is_system, notes);
 * missing rows are inserted. Policy rows no longer in POLICIES are left
 * alone — retire one by editing it here to the desired state, or delete it
 * deliberately.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { POLICIES, POLICY_CONFIDENCE, type PolicyDefinition } from './policies';
import { clearRulesCache } from './rule-matcher';
import { logRuleEvents, type RuleEvent } from './rule-events';

export interface PolicySyncResult {
  inserted: string[];
  updated: string[];
  unchanged: string[];
  /** Policies Chris changed via an "always" answer — left as-is; update policies.ts to match. */
  overridden: string[];
}

interface ExistingRow {
  id: string;
  pattern: string;
  match_type: string;
  category_id: string;
  confidence: number;
  is_system: boolean | null;
  account_id: string | null;
  amount_sign: string | null;
  amount_min: number | null;
  amount_max: number | null;
  action: string;
  notes: string | null;
}

function sameNum(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) < 0.0001;
}

/** Resolve names → ids and build the row a policy should be. */
export function policyRow(
  def: PolicyDefinition,
  categoryIdByName: Map<string, string>,
  accountIdByName: Map<string, string>
) {
  const categoryId = categoryIdByName.get(def.categoryName);
  if (!categoryId) throw new Error(`Policy ${def.key}: unknown category "${def.categoryName}"`);
  let accountId: string | null = null;
  if (def.accountName) {
    accountId = accountIdByName.get(def.accountName) ?? null;
    if (!accountId) throw new Error(`Policy ${def.key}: unknown account "${def.accountName}"`);
  }
  return {
    pattern: def.pattern,
    match_type: 'contains' as const,
    category_id: categoryId,
    confidence: POLICY_CONFIDENCE,
    is_system: true,
    account_id: accountId,
    amount_sign: def.amountSign ?? null,
    amount_min: def.amountMin ?? null,
    amount_max: def.amountMax ?? null,
    action: def.action ?? 'categorise',
    notes: `policy:${def.key} — ${def.note}`,
  };
}

export async function syncPolicies(opts: { dryRun?: boolean } = {}): Promise<PolicySyncResult> {
  const [{ data: cats, error: catErr }, { data: accts, error: acctErr }, { data: existing, error: exErr }] =
    await Promise.all([
      supabaseAdmin.from('categories').select('id, name'),
      supabaseAdmin.from('accounts').select('id, name'),
      supabaseAdmin
        .from('category_mappings')
        .select('id, pattern, match_type, category_id, confidence, is_system, account_id, amount_sign, amount_min, amount_max, action, notes'),
    ]);
  if (catErr || acctErr || exErr) {
    throw new Error(`Policy sync: read failed: ${(catErr ?? acctErr ?? exErr)!.message}`);
  }
  const categoryIdByName = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const accountIdByName = new Map((accts ?? []).map((a) => [a.name, a.id]));
  const rows = (existing ?? []) as unknown as ExistingRow[];

  const result: PolicySyncResult = { inserted: [], updated: [], unchanged: [], overridden: [] };
  const events: RuleEvent[] = [];

  for (const def of POLICIES) {
    const want = policyRow(def, categoryIdByName, accountIdByName);
    const match = rows.find(
      (r) =>
        r.pattern.toLowerCase().trim() === want.pattern &&
        r.match_type === want.match_type &&
        (r.account_id ?? null) === want.account_id &&
        (r.amount_sign ?? null) === want.amount_sign &&
        sameNum(r.amount_min, want.amount_min) &&
        sameNum(r.amount_max, want.amount_max)
    );

    if (!match) {
      result.inserted.push(def.key);
      if (opts.dryRun) continue;
      const { data, error } = await supabaseAdmin.from('category_mappings').insert(want).select('id').single();
      if (error) throw new Error(`Policy ${def.key}: insert failed: ${error.message}`);
      events.push({ ruleId: data.id, pattern: want.pattern, event: 'created', newCategoryId: want.category_id, source: 'policies:sync', detail: { key: def.key } });
      continue;
    }

    // Chris overrode this policy with an "always" answer after it was
    // written here — his later decision wins; flag so policies.ts is updated.
    if ((match.notes ?? '').includes('answer:always')) {
      result.overridden.push(def.key);
      continue;
    }

    const differs =
      match.category_id !== want.category_id ||
      match.action !== want.action ||
      !sameNum(match.confidence, want.confidence) ||
      match.is_system !== true ||
      match.notes !== want.notes;
    if (!differs) {
      result.unchanged.push(def.key);
      continue;
    }
    result.updated.push(def.key);
    if (opts.dryRun) continue;
    const { error } = await supabaseAdmin
      .from('category_mappings')
      .update({
        category_id: want.category_id,
        action: want.action,
        confidence: want.confidence,
        is_system: true,
        notes: want.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id);
    if (error) throw new Error(`Policy ${def.key}: update failed: ${error.message}`);
    events.push({
      ruleId: match.id,
      pattern: want.pattern,
      event: match.category_id !== want.category_id ? 'repointed' : 'updated',
      oldCategoryId: match.category_id,
      newCategoryId: want.category_id,
      source: 'policies:sync',
      detail: { key: def.key },
    });
  }

  if (!opts.dryRun) {
    clearRulesCache();
    await logRuleEvents(events);
  }
  return result;
}
