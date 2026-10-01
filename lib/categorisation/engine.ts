/**
 * Categorisation Engine
 *
 * Main orchestrator for transaction categorisation using multiple strategies:
 * 1. Rules (category_mappings) — policy rules first, then exact, contains, regex
 * 2. Similar transaction lookup (pg_trgm similarity over settled history)
 * 3. AI fallback (Claude API), given precedents, recent corrections and policies
 *
 * The engine also decides whether each result needs Chris's review
 * (`needsReview`), so every caller flags rows the same way.
 */

import { matchRulesBatch, type RuleMatch } from './rule-matcher';
import {
  findSimilarTransactions,
  getMostCommonCategory,
  type SimilarMatch,
} from './similar-lookup';
import {
  categoriseBatchWithAI,
  trackAIUsage,
  checkAIAvailability,
} from './ai-categoriser';
import { buildAIContext } from './ai-context';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  reference?: string;
  /** Finance account id — needed for account-scoped policy rules. */
  accountId?: string | null;
}

export type EngineSource =
  | 'policy'
  | 'policy_ask'
  | 'rule_exact'
  | 'rule_pattern'
  | 'similar'
  | 'ai'
  | 'none';

export interface CategorisationResult {
  categoryId: string | null;
  categoryName: string | null;
  source: EngineSource;
  confidence: number;
  matchDetails: string;
  /**
   * True when Chris must confirm this row (low confidence, ask policy, new
   * merchant via AI…). Always set by the engine; optional only so UI code can
   * build ad-hoc results (manual overrides in the import preview).
   */
  needsReview?: boolean;
  /** Why the row needs review (absent when it doesn't). */
  reviewReason?: string;
  /** The category_mappings rule that decided it, for rule/policy sources. */
  ruleId?: string;
  alternatives?: {
    categoryId: string;
    categoryName: string;
    confidence: number;
  }[];
}

export interface CategorisationStats {
  total: number;
  categorised: number;
  uncategorised: number;
  bySource: Record<EngineSource, number>;
  highConfidence: number;
  lowConfidence: number;
  aiUsed: number;
}

export interface CategoriseOptions {
  /** Allow the Claude fallback (default true). Re-categorisation passes false. */
  allowAI?: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const ENGINE_CONFIG = {
  similarityThreshold: 0.3, // Absolute floor — below this a similar match is noise
  similarStrongSimilarity: 0.65, // Strong (auto-trust) match needs at least this…
  similarStrongAgreement: 3, // …and this many of the top-5 agreeing on the category
  precedentSimilarity: 0.5, // An AI guess with no settled precedent this close is always reviewed
  similarLookupConcurrency: 5,
};

/**
 * Rows categorised with confidence below this are applied best-effort but
 * flagged `needs_review`.
 */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.8;

/**
 * Resolve the top similar matches into a candidate categorisation.
 *
 * The category is the MAJORITY category among matches (not the single best
 * match — one high-scoring wrong precedent must not outvote three agreeing
 * ones). Strong = majority agreement + decent similarity → trusted.
 * Weak = best guess only; callers should prefer AI and flag for review.
 */
function resolveSimilarMatch(
  similarMatches: SimilarMatch[]
): (Omit<CategorisationResult, 'needsReview'> & { strong: boolean }) | null {
  if (similarMatches.length === 0) return null;

  const commonCategory = getMostCommonCategory(similarMatches);
  if (!commonCategory) return null;

  const rep = similarMatches.find((m) => m.categoryId === commonCategory.categoryId);
  if (!rep || rep.similarity < ENGINE_CONFIG.similarityThreshold) return null;

  const strong =
    commonCategory.count >= ENGINE_CONFIG.similarStrongAgreement &&
    rep.similarity >= ENGINE_CONFIG.similarStrongSimilarity;

  const confidence = strong
    ? Math.min(0.95, rep.similarity + 0.05 * commonCategory.count)
    : Math.min(0.6, rep.similarity);

  return {
    categoryId: rep.categoryId,
    categoryName: rep.categoryName,
    source: 'similar',
    confidence,
    strong,
    matchDetails: `${strong ? 'Similar' : 'Weakly similar'} to "${rep.description.slice(0, 50)}" (${Math.round(rep.similarity * 100)}% match, ${commonCategory.count}/${similarMatches.length} agree)`,
    alternatives: similarMatches
      .filter((m) => m.categoryId !== rep.categoryId)
      .slice(0, 3)
      .map((m) => ({
        categoryId: m.categoryId,
        categoryName: m.categoryName,
        confidence: m.similarity,
      })),
  };
}

/** Turn a rule match into a result. `ask` policies always go to review. */
function fromRule(rule: RuleMatch): CategorisationResult {
  if (rule.action === 'ask') {
    return {
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
      source: 'policy_ask',
      confidence: Math.min(rule.confidence, 0.5),
      matchDetails: `Policy "${rule.pattern}": always ask (suggest ${rule.categoryName})`,
      needsReview: true,
      reviewReason: 'policy: always ask',
      ruleId: rule.ruleId,
    };
  }
  const source: EngineSource = rule.isPolicy
    ? 'policy'
    : rule.matchType === 'exact'
      ? 'rule_exact'
      : 'rule_pattern';
  const label = rule.isPolicy ? 'Policy' : rule.matchType === 'exact' ? 'Exact rule' : 'Pattern rule';
  return withReview({
    categoryId: rule.categoryId,
    categoryName: rule.categoryName,
    source,
    confidence: rule.confidence,
    matchDetails: `${label}: "${rule.pattern}"`,
    ruleId: rule.ruleId,
  });
}

function none(matchDetails: string): CategorisationResult {
  return {
    categoryId: null,
    categoryName: null,
    source: 'none',
    confidence: 0,
    matchDetails,
    needsReview: true,
    reviewReason: 'uncategorised',
  };
}

/** Standard review decision: uncategorised or below the confidence gate. */
function withReview(r: Omit<CategorisationResult, 'needsReview'>): CategorisationResult {
  if (!r.categoryId) return { ...r, needsReview: true, reviewReason: 'uncategorised' };
  if (r.confidence < CONFIDENCE_REVIEW_THRESHOLD) {
    return { ...r, needsReview: true, reviewReason: `low confidence (${r.confidence.toFixed(2)})` };
  }
  return { ...r, needsReview: false };
}

function stripStrong(
  s: Omit<CategorisationResult, 'needsReview'> & { strong: boolean }
): CategorisationResult {
  const { strong: _strong, ...rest } = s;
  return withReview(rest);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// =============================================================================
// SINGLE TRANSACTION CATEGORISATION
// =============================================================================

/**
 * Categorise a single transaction using the multi-strategy approach.
 */
export async function categoriseTransaction(
  transaction: ParsedTransaction,
  opts: CategoriseOptions = {}
): Promise<CategorisationResult> {
  const [result] = await categoriseMultiple([transaction], opts);
  return result;
}

// =============================================================================
// BATCH CATEGORISATION
// =============================================================================

/**
 * Categorise multiple transactions efficiently.
 * Batches rule lookups, similar searches, and AI calls.
 */
export async function categoriseMultiple(
  transactions: ParsedTransaction[],
  opts: CategoriseOptions = {}
): Promise<CategorisationResult[]> {
  if (transactions.length === 0) {
    return [];
  }
  const allowAI = opts.allowAI ?? true;

  const results: CategorisationResult[] = new Array(transactions.length);
  const needsSimilarLookup: number[] = [];

  // Step 1: Batch rule matching (policies need amount + account)
  const ruleMatches = await matchRulesBatch(
    transactions.map((t) => ({ description: t.description, amount: t.amount, accountId: t.accountId }))
  );

  for (let i = 0; i < transactions.length; i++) {
    const ruleMatch = ruleMatches.get(i);
    if (ruleMatch) {
      results[i] = fromRule(ruleMatch);
    } else {
      needsSimilarLookup.push(i);
    }
  }

  // Step 2: Similar transaction lookup for unmatched. Strong matches are
  // final; weak ones are remembered as fallbacks and passed on to AI.
  const weakSimilar = new Map<number, CategorisationResult>();
  const similarByIndex = new Map<number, SimilarMatch[]>();
  const needsAI: number[] = [];
  const lookups = await mapLimit(needsSimilarLookup, ENGINE_CONFIG.similarLookupConcurrency, (i) =>
    findSimilarTransactions(transactions[i].description, 5)
  );
  needsSimilarLookup.forEach((i, k) => {
    const similarMatches = lookups[k] ?? [];
    similarByIndex.set(i, similarMatches);
    const similar = resolveSimilarMatch(similarMatches);

    if (similar?.strong) {
      results[i] = stripStrong(similar);
      return;
    }
    if (similar) weakSimilar.set(i, stripStrong(similar));
    needsAI.push(i);
  });

  const fallback = (i: number, reason: string) => weakSimilar.get(i) ?? none(reason);

  if (needsAI.length === 0) return results;

  if (!allowAI) {
    for (const i of needsAI) results[i] = fallback(i, 'No rule or strong precedent (AI not used)');
    return results;
  }

  // Step 3: AI fallback for remaining unmatched, up to the daily cap.
  const aiAvailability = await checkAIAvailability();
  const quota = aiAvailability.available ? aiAvailability.remaining : 0;
  const toAI = needsAI.slice(0, quota);
  for (const i of needsAI.slice(quota)) {
    results[i] = fallback(
      i,
      aiAvailability.available ? 'AI daily cap reached for this batch' : 'AI categorisation not available'
    );
  }
  if (toAI.length === 0) return results;

  const hasPrecedent = (i: number) =>
    (similarByIndex.get(i) ?? []).some((m) => m.similarity >= ENGINE_CONFIG.precedentSimilarity);

  try {
    const context = await buildAIContext(
      toAI.map((i) => ({ description: transactions[i].description, similar: similarByIndex.get(i) ?? [] }))
    );
    const aiResults = await categoriseBatchWithAI(
      toAI.map((i) => ({
        date: transactions[i].date,
        description: transactions[i].description,
        amount: transactions[i].amount,
      })),
      context
    );
    await trackAIUsage(toAI.length);

    toAI.forEach((i, j) => {
      const aiResult = aiResults.get(j);
      if (!aiResult || !aiResult.categoryId) {
        results[i] = fallback(i, aiResult ? 'AI returned an unknown category' : 'AI categorisation did not return result');
        return;
      }
      const base = withReview({
        categoryId: aiResult.categoryId,
        categoryName: aiResult.categoryName,
        source: 'ai',
        confidence: aiResult.confidence,
        matchDetails: aiResult.reasoning,
        alternatives: aiResult.alternatives,
      });
      // A brand-new merchant can't be approved on Claude's say-so alone.
      results[i] =
        !base.needsReview && !hasPrecedent(i)
          ? { ...base, needsReview: true, reviewReason: 'new merchant (no settled precedent)' }
          : base;
    });
  } catch (error) {
    console.warn('Batch AI categorisation failed:', error);
    for (const i of toAI) {
      if (!results[i]) results[i] = fallback(i, 'AI categorisation failed');
    }
  }

  return results;
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Calculate statistics from categorisation results.
 */
export function calculateStats(results: CategorisationResult[]): CategorisationStats {
  const stats: CategorisationStats = {
    total: results.length,
    categorised: 0,
    uncategorised: 0,
    bySource: {
      policy: 0,
      policy_ask: 0,
      rule_exact: 0,
      rule_pattern: 0,
      similar: 0,
      ai: 0,
      none: 0,
    },
    highConfidence: 0,
    lowConfidence: 0,
    aiUsed: 0,
  };

  for (const result of results) {
    stats.bySource[result.source]++;

    if (result.categoryId) {
      stats.categorised++;
      if (result.confidence >= 0.8) {
        stats.highConfidence++;
      } else if (result.confidence < 0.5) {
        stats.lowConfidence++;
      }
    } else {
      stats.uncategorised++;
    }

    if (result.source === 'ai') {
      stats.aiUsed++;
    }
  }

  return stats;
}

// =============================================================================
// DB MAPPING
// =============================================================================

export type DbCategorisationSource = 'manual' | 'rule' | 'ai' | 'import';

/** Engine source → the finance.categorisation_source enum (engine_source keeps the detail). */
export function toDbCategorisationSource(source: EngineSource | string): DbCategorisationSource {
  switch (source) {
    case 'policy':
    case 'policy_ask':
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

/** Columns every sync / re-categorisation path writes for an engine result. */
export function toTransactionCategoryFields(r: CategorisationResult) {
  return {
    category_id: r.categoryId,
    categorisation_source: toDbCategorisationSource(r.source),
    engine_source: r.source,
    categorisation_confidence: r.categoryId ? r.confidence : null,
    needs_review: r.needsReview ?? (!r.categoryId || r.confidence < CONFIDENCE_REVIEW_THRESHOLD),
  };
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { clearRulesCache } from './rule-matcher';
export { clearCategoriesCache, checkAIAvailability } from './ai-categoriser';
