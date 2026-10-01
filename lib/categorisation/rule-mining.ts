/**
 * Merchant Rule Mining
 *
 * Turns categorised transaction history into deterministic merchant rules,
 * and — just as important — retires rules that Chris keeps overriding.
 *
 * Each run:
 * 1. Supersede (A1): a non-system rule whose recent MANUAL matches (last 180
 *    days) mostly disagree with it is re-pointed to the category Chris keeps
 *    choosing, or deleted when there's no clear winner. Rule-applied rows are
 *    not evidence (that would be circular); only Chris's decisions count.
 * 2. Clean up (A7): mined rules containing digit tokens (order/branch numbers)
 *    are deleted — the normaliser no longer produces such keys — and so are
 *    mined rules whose settled matches now agree < 60% of the time.
 * 3. Mine: any normalised merchant seen ≥3 times with ≥90% category agreement
 *    among settled rows becomes a `contains` rule — provided the pattern ALSO
 *    holds ≥90% across every settled row it would match (a key like
 *    "tonbridge" must not capture every merchant in town).
 * 4. Re-categorise the review queue against the updated rules (A8).
 *
 * Safety:
 * - `is_system` (policy) rules are never changed by mining.
 * - Mined rules are tagged in `notes` ("mined:v1 …"); every change is logged
 *   to category_rule_events.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { merchantKey, isMineablePattern, normaliseDescription } from './normalise';
import { clearRulesCache, ruleApplies, type RuleRecord } from './rule-matcher';
import { logRuleEvents, type RuleEvent } from './rule-events';
import { recategorisePending, type RecategoriseResult } from './recategorise';

const MINING_CONFIG = {
  minTransactions: 3,
  minAgreement: 0.9,
  pageSize: 1000, // Supabase caps selects at 1,000 rows — paginate everything
  ruleConfidence: 0.9,
  supersedeLookbackDays: 180,
  supersedeMinDisagree: 2,
  supersedeRepointShare: 0.75,
  retireMinMatches: 4,
  retireBelowAgreement: 0.6,
};

export interface MinedCandidate {
  pattern: string;
  categoryId: string;
  total: number;
  agreement: number;
}

export interface EvidenceRow {
  description: string;
  amount: number;
  account_id: string | null;
  date?: string | null;
  category_id: string;
}

export interface Supersession {
  ruleId: string;
  pattern: string;
  action: 'repoint' | 'delete';
  oldCategoryId: string;
  newCategoryId: string | null;
  evidence: { total: number; disagree: number; topShare: number };
}

export interface MiningResult {
  scanned: number;
  candidates: MinedCandidate[];
  /** Candidates whose pattern would capture disagreeing rows outside its merchant group. */
  rejectedBroad: (MinedCandidate & { matched: number; broadAgreement: number })[];
  created: number;
  skippedExisting: number;
  conflicts: { pattern: string; existingCategoryId: string; minedCategoryId: string }[];
  superseded: Supersession[];
  digitRulesDeleted: string[];
  lowQualityDeleted: { pattern: string; matched: number; agreement: number }[];
  recategorised: RecategoriseResult | null;
}

type MappingRow = RuleRecord & { notes: string | null };

// =============================================================================
// DATA ACCESS
// =============================================================================

async function paginate<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  what: string
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await build(page * MINING_CONFIG.pageSize, (page + 1) * MINING_CONFIG.pageSize - 1);
    if (error) throw new Error(`Rule mining: failed to read ${what}: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < MINING_CONFIG.pageSize) break;
  }
  return rows;
}

/** Every settled categorised transaction (paginated past the 1k cap). */
async function fetchSettledTransactions(): Promise<SettledRow[]> {
  const rows = await paginate<{ date: string; description: string; amount: number; account_id: string | null; category_id: string | null }>(
    (from, to) =>
      supabaseAdmin
        .from('transactions')
        .select('date, description, amount, account_id, category_id')
        .not('category_id', 'is', null)
        .eq('needs_review', false)
        .order('id', { ascending: true })
        .range(from, to),
    'transactions'
  );
  return rows
    .filter((r): r is typeof r & { category_id: string } => Boolean(r.category_id))
    .map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Chris's own decisions over the supersession window. */
async function fetchManualEvidence(now: Date): Promise<EvidenceRow[]> {
  const since = new Date(now.getTime() - MINING_CONFIG.supersedeLookbackDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const rows = await paginate<{ date: string; description: string; amount: number; account_id: string | null; category_id: string | null }>(
    (from, to) =>
      supabaseAdmin
        .from('transactions')
        .select('date, description, amount, account_id, category_id')
        .eq('categorisation_source', 'manual')
        .eq('needs_review', false)
        .not('category_id', 'is', null)
        .gte('date', since)
        .order('id', { ascending: true })
        .range(from, to),
    'manual evidence'
  );
  return rows
    .filter((r): r is typeof r & { category_id: string } => Boolean(r.category_id))
    .map((r) => ({ ...r, amount: Number(r.amount) }));
}

async function fetchRules(): Promise<MappingRow[]> {
  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .select(
      'id, pattern, category_id, match_type, confidence, is_system, account_id, amount_sign, amount_min, amount_max, days_of_week, action, notes, categories (id, name)'
    );
  if (error) throw new Error(`Rule mining: failed to read rules: ${error.message}`);
  return (data ?? []) as unknown as MappingRow[];
}

// =============================================================================
// PURE LOGIC
// =============================================================================

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
 * Pure (A1): which non-system rules does Chris's manual evidence contradict?
 *
 * A rule is superseded when ≥2 of its manual matches disagree with it and
 * they are the majority. It is re-pointed when one other category holds
 * ≥75% of the manual matches, otherwise deleted.
 */
export function findSupersessions(rules: RuleRecord[], evidence: EvidenceRow[]): Supersession[] {
  const out: Supersession[] = [];
  for (const rule of rules) {
    if (rule.is_system) continue;

    const counts = new Map<string, number>();
    let total = 0;
    for (const row of evidence) {
      if (!ruleApplies(rule, { description: row.description, amount: row.amount, accountId: row.account_id, date: row.date })) continue;
      total++;
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
    if (total === 0) continue;

    const agree = counts.get(rule.category_id) ?? 0;
    const disagree = total - agree;
    if (disagree < MINING_CONFIG.supersedeMinDisagree || disagree / total <= 0.5) continue;

    let topCategory: string | null = null;
    let topCount = 0;
    counts.forEach((n, cat) => {
      if (cat !== rule.category_id && n > topCount) {
        topCount = n;
        topCategory = cat;
      }
    });
    const topShare = topCount / total;
    const repoint = topCategory !== null && topShare >= MINING_CONFIG.supersedeRepointShare;
    out.push({
      ruleId: rule.id,
      pattern: rule.pattern,
      action: repoint ? 'repoint' : 'delete',
      oldCategoryId: rule.category_id,
      newCategoryId: repoint ? topCategory : null,
      evidence: { total, disagree, topShare: Math.round(topShare * 100) / 100 },
    });
  }
  return out;
}

/** Mined rules whose pattern carries a digit token (order/branch refs). */
export function findDigitRules(rules: MappingRow[]): MappingRow[] {
  return rules.filter((r) => !r.is_system && (r.notes ?? '').startsWith('mined') && /\d/.test(r.pattern));
}

export interface SettledRow {
  description: string;
  amount: number;
  account_id: string | null;
  date?: string | null;
  category_id: string;
}

/**
 * Pure: drop candidates whose pattern, as a token-bounded contains rule,
 * would match settled rows OUTSIDE its merchant group that disagree. A key
 * mined from one group ("tonbridge" from "TONBRIDGE KEBABS…") must not
 * become a rule that captures every merchant in Tonbridge.
 */
export function rejectBroadCandidates(
  candidates: MinedCandidate[],
  rows: SettledRow[]
): { kept: MinedCandidate[]; rejected: (MinedCandidate & { matched: number; broadAgreement: number })[] } {
  const normalised = rows.map((r) => ` ${normaliseDescription(r.description)} `);
  const kept: MinedCandidate[] = [];
  const rejected: (MinedCandidate & { matched: number; broadAgreement: number })[] = [];
  for (const c of candidates) {
    const needle = ` ${c.pattern} `;
    let matched = 0;
    let agree = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!normalised[i].includes(needle)) continue;
      matched++;
      if (rows[i].category_id === c.categoryId) agree++;
    }
    const broadAgreement = matched > 0 ? agree / matched : 0;
    if (broadAgreement >= MINING_CONFIG.minAgreement) kept.push(c);
    else rejected.push({ ...c, matched, broadAgreement: Math.round(broadAgreement * 100) / 100 });
  }
  return { kept, rejected };
}

/**
 * Pure: existing MINED rules that today's settled history no longer
 * supports — fewer than 60% of the (≥4) settled rows they match agree.
 * (New rules need 90%; the gap avoids flip-flopping.)
 */
export function findLowQualityMinedRules(rules: MappingRow[], rows: SettledRow[]): { rule: MappingRow; matched: number; agreement: number }[] {
  const out: { rule: MappingRow; matched: number; agreement: number }[] = [];
  for (const rule of rules) {
    if (rule.is_system || !(rule.notes ?? '').startsWith('mined')) continue;
    let matched = 0;
    let agree = 0;
    for (const r of rows) {
      if (!ruleApplies(rule, { description: r.description, amount: r.amount, accountId: r.account_id, date: r.date })) continue;
      matched++;
      if (r.category_id === rule.category_id) agree++;
    }
    if (matched < MINING_CONFIG.retireMinMatches) continue;
    const agreement = agree / matched;
    if (agreement < MINING_CONFIG.retireBelowAgreement) {
      out.push({ rule, matched, agreement: Math.round(agreement * 100) / 100 });
    }
  }
  return out;
}

// =============================================================================
// RUN
// =============================================================================

async function deleteRule(ruleId: string): Promise<void> {
  // category_corrections.created_rule_id references the rule.
  await supabaseAdmin.from('category_corrections').update({ created_rule_id: null }).eq('created_rule_id', ruleId);
  const { error } = await supabaseAdmin.from('category_mappings').delete().eq('id', ruleId);
  if (error) throw new Error(`Rule mining: delete failed for ${ruleId}: ${error.message}`);
}

/**
 * Supersede contradicted rules, clean digit rules, mine new rules, then
 * re-categorise the queue. `dryRun` reports without writing.
 */
export async function mineMerchantRules(
  opts: { dryRun?: boolean; now?: Date; skipRecategorise?: boolean } = {}
): Promise<MiningResult> {
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const events: RuleEvent[] = [];

  // 1. Supersede contradicted rules.
  let rules = await fetchRules();
  const evidence = await fetchManualEvidence(now);
  const superseded = findSupersessions(rules, evidence);

  // 2. Digit-token mined rules, and mined rules settled history no longer supports.
  const supersededIds = new Set(superseded.map((s) => s.ruleId));
  const digitRules = findDigitRules(rules).filter((r) => !supersededIds.has(r.id));
  const rows = await fetchSettledTransactions();
  const digitIds = new Set(digitRules.map((r) => r.id));
  const lowQuality = findLowQualityMinedRules(
    rules.filter((r) => !supersededIds.has(r.id) && !digitIds.has(r.id)),
    rows
  );

  if (!opts.dryRun) {
    for (const s of superseded) {
      const rule = rules.find((r) => r.id === s.ruleId)!;
      if (s.action === 'repoint' && s.newCategoryId) {
        const { error } = await supabaseAdmin
          .from('category_mappings')
          .update({
            category_id: s.newCategoryId,
            notes: `${rule.notes ? `${rule.notes} | ` : ''}superseded:${rule.categories?.name ?? s.oldCategoryId}:${today}`,
            updated_at: now.toISOString(),
          })
          .eq('id', s.ruleId);
        if (error) throw new Error(`Rule mining: re-point failed for "${s.pattern}": ${error.message}`);
        events.push({
          ruleId: s.ruleId, pattern: s.pattern, event: 'repointed',
          oldCategoryId: s.oldCategoryId, newCategoryId: s.newCategoryId, source: 'mining', detail: s.evidence,
        });
      } else {
        await deleteRule(s.ruleId);
        events.push({
          ruleId: s.ruleId, pattern: s.pattern, event: 'deleted',
          oldCategoryId: s.oldCategoryId, source: 'mining', detail: { ...s.evidence, reason: 'contradicted by manual history' },
        });
      }
    }
    for (const r of digitRules) {
      await deleteRule(r.id);
      events.push({
        ruleId: r.id, pattern: r.pattern, event: 'deleted',
        oldCategoryId: r.category_id, source: 'mining', detail: { reason: 'digit token (order/branch reference)' },
      });
    }
    for (const { rule: r, matched, agreement } of lowQuality) {
      await deleteRule(r.id);
      events.push({
        ruleId: r.id, pattern: r.pattern, event: 'deleted',
        oldCategoryId: r.category_id, source: 'mining', detail: { reason: 'settled history no longer supports it', matched, agreement },
      });
    }
    if (superseded.length > 0 || digitRules.length > 0 || lowQuality.length > 0) {
      clearRulesCache();
      rules = await fetchRules();
    }
  }

  // 3. Mine new rules — only patterns that hold up across EVERY settled row
  //    they would match, not just their own merchant group.
  const { kept: candidates, rejected: rejectedBroad } = rejectBroadCandidates(findMineableMerchants(rows), rows);
  const removed = new Set(
    opts.dryRun
      ? [
          ...superseded.filter((s) => s.action === 'delete').map((s) => s.ruleId),
          ...digitRules.map((r) => r.id),
          ...lowQuality.map((l) => l.rule.id),
        ]
      : []
  );
  const existingByPattern = new Map(
    rules.filter((r) => !removed.has(r.id)).map((r) => [r.pattern.toLowerCase().trim(), r])
  );

  const result: MiningResult = {
    scanned: rows.length,
    candidates,
    rejectedBroad,
    created: 0,
    skippedExisting: 0,
    conflicts: [],
    superseded,
    digitRulesDeleted: digitRules.map((r) => r.pattern),
    lowQualityDeleted: lowQuality.map((l) => ({ pattern: l.rule.pattern, matched: l.matched, agreement: l.agreement })),
    recategorised: null,
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
        // History (incl. rule-applied rows) disagrees but Chris's own manual
        // decisions didn't trigger supersession — surface, don't override.
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

  if (opts.dryRun) {
    result.created = toInsert.length; // what WOULD be created
    return result;
  }

  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const { data, error: insErr } = await supabaseAdmin
      .from('category_mappings')
      .insert(toInsert.slice(i, i + CHUNK))
      .select('id, pattern, category_id');
    if (insErr) throw new Error(`Rule mining: insert failed: ${insErr.message}`);
    for (const r of data ?? []) {
      events.push({ ruleId: r.id, pattern: r.pattern, event: 'created', newCategoryId: r.category_id, source: 'mining' });
    }
    result.created += data?.length ?? 0;
  }
  clearRulesCache();
  await logRuleEvents(events);

  // 4. The queue may now be answerable.
  if (!opts.skipRecategorise) {
    result.recategorised = await recategorisePending();
  }

  return result;
}
