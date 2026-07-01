/**
 * Merchant Rule Mining
 *
 * Turns categorised transaction history into deterministic merchant rules:
 * any normalised merchant seen ≥3 times with ≥90% category agreement becomes
 * a `contains` rule in category_mappings. Repeat merchants (ALDI, Pret, TFL…)
 * then match instantly instead of re-running fuzzy similarity or AI on every
 * import.
 *
 * Safety:
 * - Only learns from settled rows (needs_review = false).
 * - Never overrides an existing rule that maps the same pattern to a
 *   DIFFERENT category (human/system rules win); conflicts are reported.
 * - Mined rules are tagged in `notes` ("mined:v1 …") so they are identifiable
 *   and reversible as a set.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { merchantKey, isMineablePattern } from './normalise';
import { clearRulesCache } from './rule-matcher';

const MINING_CONFIG = {
  minTransactions: 3,
  minAgreement: 0.9,
  pageSize: 1000, // Supabase caps selects at 1,000 rows — paginate everything
  ruleConfidence: 0.9,
};

export interface MinedCandidate {
  pattern: string;
  categoryId: string;
  total: number;
  agreement: number;
}

export interface MiningResult {
  scanned: number;
  candidates: MinedCandidate[];
  created: number;
  skippedExisting: number;
  conflicts: { pattern: string; existingCategoryId: string; minedCategoryId: string }[];
}

/** Fetch every settled categorised transaction (paginated past the 1k cap). */
async function fetchSettledTransactions(): Promise<{ description: string; category_id: string }[]> {
  const rows: { description: string; category_id: string }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('description, category_id')
      .not('category_id', 'is', null)
      .eq('needs_review', false)
      .order('id', { ascending: true })
      .range(page * MINING_CONFIG.pageSize, (page + 1) * MINING_CONFIG.pageSize - 1);
    if (error) throw new Error(`Rule mining: failed to read transactions: ${error.message}`);
    const batch = (data ?? []) as { description: string; category_id: string | null }[];
    for (const r of batch) {
      if (r.category_id) rows.push({ description: r.description, category_id: r.category_id });
    }
    if (batch.length < MINING_CONFIG.pageSize) break;
  }
  return rows;
}

/** Pure: group settled rows by merchant key and find high-agreement merchants. */
export function findMineableMerchants(
  rows: { description: string; category_id: string }[]
): MinedCandidate[] {
  const byMerchant = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const key = merchantKey(row.description);
    if (!isMineablePattern(key)) continue;
    const counts = byMerchant.get(key) ?? new Map<string, number>();
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    byMerchant.set(key, counts);
  }

  const candidates: MinedCandidate[] = [];
  for (const [pattern, counts] of Array.from(byMerchant.entries())) {
    let total = 0;
    let bestCategoryId = '';
    let bestCount = 0;
    for (const [categoryId, count] of Array.from(counts.entries())) {
      total += count;
      if (count > bestCount) {
        bestCount = count;
        bestCategoryId = categoryId;
      }
    }
    const agreement = total > 0 ? bestCount / total : 0;
    if (total >= MINING_CONFIG.minTransactions && agreement >= MINING_CONFIG.minAgreement) {
      candidates.push({ pattern, categoryId: bestCategoryId, total, agreement });
    }
  }

  return candidates.sort((a, b) => b.total - a.total);
}

/**
 * Mine merchant rules from history and (unless dryRun) insert the new ones.
 */
export async function mineMerchantRules(opts: { dryRun?: boolean } = {}): Promise<MiningResult> {
  const rows = await fetchSettledTransactions();
  const candidates = findMineableMerchants(rows);

  // Existing rules, keyed by lowercased pattern (any match type).
  const { data: existingRules, error: rulesErr } = await supabaseAdmin
    .from('category_mappings')
    .select('id, pattern, category_id, match_type');
  if (rulesErr) throw new Error(`Rule mining: failed to read rules: ${rulesErr.message}`);
  const existingByPattern = new Map(
    (existingRules ?? []).map((r) => [r.pattern.toLowerCase().trim(), r])
  );

  const result: MiningResult = {
    scanned: rows.length,
    candidates,
    created: 0,
    skippedExisting: 0,
    conflicts: [],
  };

  const toInsert: {
    pattern: string;
    category_id: string;
    match_type: 'contains';
    confidence: number;
    is_system: boolean;
    notes: string;
  }[] = [];

  for (const c of candidates) {
    const existing = existingByPattern.get(c.pattern);
    if (existing) {
      if (existing.category_id === c.categoryId) {
        result.skippedExisting++;
      } else {
        // A human/system rule disagrees with history — surface, never override.
        result.conflicts.push({
          pattern: c.pattern,
          existingCategoryId: existing.category_id,
          minedCategoryId: c.categoryId,
        });
      }
      continue;
    }

    toInsert.push({
      pattern: c.pattern,
      category_id: c.categoryId,
      match_type: 'contains',
      confidence: MINING_CONFIG.ruleConfidence,
      is_system: false,
      notes: `mined:v1 n=${c.total} agree=${Math.round(c.agreement * 100)}%`,
    });
  }

  if (!opts.dryRun && toInsert.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error: insErr, count } = await supabaseAdmin
        .from('category_mappings')
        .insert(toInsert.slice(i, i + CHUNK), { count: 'exact' });
      if (insErr) throw new Error(`Rule mining: insert failed: ${insErr.message}`);
      result.created += count ?? 0;
    }
    clearRulesCache();
  } else {
    result.created = 0;
  }

  if (opts.dryRun) {
    // Report what WOULD be created
    result.created = toInsert.length;
  }

  return result;
}
