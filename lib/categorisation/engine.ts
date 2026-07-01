/**
 * Categorisation Engine
 *
 * Main orchestrator for transaction categorisation using multiple strategies:
 * 1. Exact rule match (category_mappings with match_type='exact')
 * 2. Pattern match (category_mappings with match_type='contains' or 'regex')
 * 3. Similar transaction lookup (pg_trgm similarity)
 * 4. AI fallback (Claude API)
 */

import { matchRule, matchRulesBatch, type RuleMatch } from './rule-matcher';
import {
  findSimilarTransactions,
  getMostCommonCategory,
  type SimilarMatch,
} from './similar-lookup';
import {
  categoriseWithAI,
  categoriseBatchWithAI,
  trackAIUsage,
  checkAIAvailability,
  type AICategorisationResult,
} from './ai-categoriser';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  reference?: string;
}

export interface CategorisationResult {
  categoryId: string | null;
  categoryName: string | null;
  source: 'rule_exact' | 'rule_pattern' | 'similar' | 'ai' | 'none';
  confidence: number;
  matchDetails: string;
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
  bySource: {
    rule_exact: number;
    rule_pattern: number;
    similar: number;
    ai: number;
    none: number;
  };
  highConfidence: number;
  lowConfidence: number;
  aiUsed: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const ENGINE_CONFIG = {
  similarityThreshold: 0.3, // Absolute floor — below this a similar match is noise
  similarStrongSimilarity: 0.65, // Strong (auto-trust) match needs at least this…
  similarStrongAgreement: 3, // …and this many of the top-5 agreeing on the category
  maxAIBatchSize: 10, // Max transactions per AI batch call
};

/**
 * Rows categorised with confidence below this are applied best-effort but
 * flagged `needs_review` by the import paths.
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
): (CategorisationResult & { strong: boolean }) | null {
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

// =============================================================================
// SINGLE TRANSACTION CATEGORISATION
// =============================================================================

/**
 * Categorise a single transaction using the multi-strategy approach.
 */
export async function categoriseTransaction(
  transaction: ParsedTransaction
): Promise<CategorisationResult> {
  // Strategy 1: Try exact rule match
  const ruleMatch = await matchRule(transaction.description);

  if (ruleMatch) {
    const isExact = ruleMatch.matchType === 'exact';
    return {
      categoryId: ruleMatch.categoryId,
      categoryName: ruleMatch.categoryName,
      source: isExact ? 'rule_exact' : 'rule_pattern',
      confidence: ruleMatch.confidence,
      matchDetails: `${isExact ? 'Exact' : 'Pattern'} rule: "${ruleMatch.pattern}"`,
    };
  }

  // Strategy 2: Look for similar transactions. Strong (majority-agreement)
  // matches are trusted; weak ones are kept only as a fallback if AI is
  // unavailable.
  const similarMatches = await findSimilarTransactions(transaction.description, 5);
  const similar = resolveSimilarMatch(similarMatches);

  if (similar?.strong) {
    const { strong: _strong, ...result } = similar;
    return result;
  }

  // Strategy 3: AI fallback (if available and warranted)
  const aiAvailability = await checkAIAvailability();

  if (aiAvailability.available) {
    try {
      const aiResult = await categoriseWithAI({
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
      });

      await trackAIUsage(1);

      return {
        categoryId: aiResult.categoryId,
        categoryName: aiResult.categoryName,
        source: 'ai',
        confidence: aiResult.confidence,
        matchDetails: aiResult.reasoning,
        alternatives: aiResult.alternatives,
      };
    } catch (error) {
      console.warn('AI categorisation failed:', error);
      // Fall through to weak-similar / "none" result
    }
  }

  // Strategy 4: weak similar guess — applied but low confidence, so import
  // paths flag it for review instead of trusting it silently.
  if (similar) {
    const { strong: _strong, ...result } = similar;
    return result;
  }

  // No categorisation found
  return {
    categoryId: null,
    categoryName: null,
    source: 'none',
    confidence: 0,
    matchDetails: 'No matching category found',
  };
}

// =============================================================================
// BATCH CATEGORISATION
// =============================================================================

/**
 * Categorise multiple transactions efficiently.
 * Batches rule lookups, similar searches, and AI calls.
 */
export async function categoriseMultiple(
  transactions: ParsedTransaction[]
): Promise<CategorisationResult[]> {
  if (transactions.length === 0) {
    return [];
  }

  const results: CategorisationResult[] = new Array(transactions.length);
  const needsSimilarLookup: number[] = [];
  const needsAI: number[] = [];

  // Step 1: Batch rule matching
  const descriptions = transactions.map((t) => t.description);
  const ruleMatches = await matchRulesBatch(descriptions);

  for (let i = 0; i < transactions.length; i++) {
    const ruleMatch = ruleMatches.get(i);

    if (ruleMatch) {
      const isExact = ruleMatch.matchType === 'exact';
      results[i] = {
        categoryId: ruleMatch.categoryId,
        categoryName: ruleMatch.categoryName,
        source: isExact ? 'rule_exact' : 'rule_pattern',
        confidence: ruleMatch.confidence,
        matchDetails: `${isExact ? 'Exact' : 'Pattern'} rule: "${ruleMatch.pattern}"`,
      };
    } else {
      needsSimilarLookup.push(i);
    }
  }

  // Step 2: Similar transaction lookup for unmatched. Strong matches are
  // final; weak ones are remembered as fallbacks and passed on to AI.
  const weakSimilar = new Map<number, CategorisationResult>();
  for (const i of needsSimilarLookup) {
    const similarMatches = await findSimilarTransactions(transactions[i].description, 5);
    const similar = resolveSimilarMatch(similarMatches);

    if (similar?.strong) {
      const { strong: _strong, ...result } = similar;
      results[i] = result;
      continue;
    }

    if (similar) {
      const { strong: _strong, ...result } = similar;
      weakSimilar.set(i, result);
    }
    needsAI.push(i);
  }

  // Step 3: AI fallback for remaining unmatched
  if (needsAI.length > 0) {
    const aiAvailability = await checkAIAvailability();

    if (aiAvailability.available && needsAI.length <= aiAvailability.remaining) {
      try {
        // Prepare transactions for AI
        const aiTransactions = needsAI.map((i) => ({
          date: transactions[i].date,
          description: transactions[i].description,
          amount: transactions[i].amount,
        }));

        // Batch AI categorisation
        const aiResults = await categoriseBatchWithAI(aiTransactions);
        await trackAIUsage(aiTransactions.length);

        // Map results back
        for (let j = 0; j < needsAI.length; j++) {
          const i = needsAI[j];
          const aiResult = aiResults.get(j);

          if (aiResult) {
            results[i] = {
              categoryId: aiResult.categoryId,
              categoryName: aiResult.categoryName,
              source: 'ai',
              confidence: aiResult.confidence,
              matchDetails: aiResult.reasoning,
              alternatives: aiResult.alternatives,
            };
          } else {
            results[i] = weakSimilar.get(i) ?? {
              categoryId: null,
              categoryName: null,
              source: 'none',
              confidence: 0,
              matchDetails: 'AI categorisation did not return result',
            };
          }
        }
      } catch (error) {
        console.warn('Batch AI categorisation failed:', error);

        // Fall back to weak similar guesses, then "none"
        for (const i of needsAI) {
          if (!results[i]) {
            results[i] = weakSimilar.get(i) ?? {
              categoryId: null,
              categoryName: null,
              source: 'none',
              confidence: 0,
              matchDetails: 'AI categorisation failed',
            };
          }
        }
      }
    } else {
      // No AI available or not enough quota — weak similar guesses beat nothing
      for (const i of needsAI) {
        results[i] = weakSimilar.get(i) ?? {
          categoryId: null,
          categoryName: null,
          source: 'none',
          confidence: 0,
          matchDetails: aiAvailability.available
            ? 'AI quota insufficient for batch'
            : 'AI categorisation not available',
        };
      }
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
// RE-EXPORTS
// =============================================================================

export { clearRulesCache } from './rule-matcher';
export { clearCategoriesCache, checkAIAvailability } from './ai-categoriser';
