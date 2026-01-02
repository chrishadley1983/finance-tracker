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
  similarityThreshold: 0.5, // Minimum similarity score for "similar" match
  similarMinCount: 2, // Minimum similar transactions to boost confidence
  aiConfidenceThreshold: 0.6, // Below this, consider AI fallback
  maxAIBatchSize: 10, // Max transactions per AI batch call
};

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

  // Strategy 2: Look for similar transactions
  const similarMatches = await findSimilarTransactions(transaction.description, 5);

  if (similarMatches.length > 0) {
    const bestMatch = similarMatches[0];
    const commonCategory = getMostCommonCategory(similarMatches);

    // Boost confidence if multiple similar transactions agree on category
    let confidence = bestMatch.similarity;
    if (commonCategory && commonCategory.count >= ENGINE_CONFIG.similarMinCount) {
      confidence = Math.min(1, confidence + 0.1 * commonCategory.count);
    }

    if (confidence >= ENGINE_CONFIG.similarityThreshold) {
      return {
        categoryId: bestMatch.categoryId,
        categoryName: bestMatch.categoryName,
        source: 'similar',
        confidence,
        matchDetails: `Similar to "${bestMatch.description}" (${Math.round(bestMatch.similarity * 100)}% match)`,
        alternatives: similarMatches.slice(1, 4).map((m) => ({
          categoryId: m.categoryId,
          categoryName: m.categoryName,
          confidence: m.similarity,
        })),
      };
    }
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
      // Fall through to "none" result
    }
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

  // Step 2: Similar transaction lookup for unmatched
  for (const i of needsSimilarLookup) {
    const similarMatches = await findSimilarTransactions(transactions[i].description, 5);

    if (similarMatches.length > 0) {
      const bestMatch = similarMatches[0];
      const commonCategory = getMostCommonCategory(similarMatches);

      let confidence = bestMatch.similarity;
      if (commonCategory && commonCategory.count >= ENGINE_CONFIG.similarMinCount) {
        confidence = Math.min(1, confidence + 0.1 * commonCategory.count);
      }

      if (confidence >= ENGINE_CONFIG.similarityThreshold) {
        results[i] = {
          categoryId: bestMatch.categoryId,
          categoryName: bestMatch.categoryName,
          source: 'similar',
          confidence,
          matchDetails: `Similar to "${bestMatch.description.slice(0, 50)}..." (${Math.round(bestMatch.similarity * 100)}% match)`,
          alternatives: similarMatches.slice(1, 4).map((m) => ({
            categoryId: m.categoryId,
            categoryName: m.categoryName,
            confidence: m.similarity,
          })),
        };
        continue;
      }
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
            results[i] = {
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

        // Fill remaining with "none"
        for (const i of needsAI) {
          if (!results[i]) {
            results[i] = {
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
      // No AI available or not enough quota
      for (const i of needsAI) {
        results[i] = {
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
