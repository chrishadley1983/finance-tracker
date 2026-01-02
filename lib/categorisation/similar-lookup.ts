/**
 * Similar Transaction Lookup
 *
 * Finds existing categorised transactions with similar descriptions
 * using PostgreSQL's pg_trgm extension for trigram similarity matching.
 */

import { supabaseAdmin } from '@/lib/supabase/server';

// =============================================================================
// TYPES
// =============================================================================

export interface SimilarMatch {
  transactionId: string;
  description: string;
  categoryId: string;
  categoryName: string;
  similarity: number;
  date: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SIMILARITY_CONFIG = {
  minSimilarity: 0.3, // Minimum trigram similarity threshold
  maxResults: 5, // Maximum similar transactions to return
  recentDaysPreference: 90, // Prefer recent transactions within this window
};

// =============================================================================
// SIMILARITY FUNCTIONS
// =============================================================================

/**
 * Find similar transactions using pg_trgm similarity.
 * Returns transactions with similar descriptions that have been categorised.
 */
interface SimilarTransactionRow {
  id: string;
  description: string;
  category_id: string;
  category_name: string;
  similarity: number;
  date: string;
}

export async function findSimilarTransactions(
  description: string,
  limit: number = SIMILARITY_CONFIG.maxResults
): Promise<SimilarMatch[]> {
  // Use raw SQL for pg_trgm similarity function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.rpc as any)('find_similar_transactions', {
    search_description: description,
    min_similarity: SIMILARITY_CONFIG.minSimilarity,
    max_results: limit,
  });

  if (error) {
    // If RPC doesn't exist, fall back to token matching
    console.warn('pg_trgm RPC not available, falling back to token matching:', error.message);
    return findSimilarByTokens(description, limit);
  }

  return ((data || []) as SimilarTransactionRow[]).map((row) => ({
    transactionId: row.id,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    similarity: Number(row.similarity),
    date: row.date,
  }));
}

/**
 * Fallback token-based similarity matching.
 * Used when pg_trgm is not available or for simple cases.
 */
async function findSimilarByTokens(
  description: string,
  limit: number
): Promise<SimilarMatch[]> {
  // Normalize and extract tokens
  const tokens = extractTokens(description);

  if (tokens.length === 0) {
    return [];
  }

  // Fetch recent categorised transactions
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select(
      `
      id,
      description,
      category_id,
      date,
      categories (
        name
      )
    `
    )
    .not('category_id', 'is', null)
    .order('date', { ascending: false })
    .limit(500); // Get recent transactions for matching

  if (error || !data) {
    console.error('Failed to fetch transactions for similarity:', error);
    return [];
  }

  // Score each transaction by token overlap
  const scored = data
    .map((tx) => {
      const txTokens = extractTokens(tx.description);
      const score = calculateTokenSimilarity(tokens, txTokens);

      return {
        transactionId: tx.id,
        description: tx.description,
        categoryId: tx.category_id!,
        categoryName: (tx.categories as { name: string } | null)?.name || 'Unknown',
        similarity: score,
        date: tx.date,
      };
    })
    .filter((tx) => tx.similarity >= SIMILARITY_CONFIG.minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

/**
 * Extract meaningful tokens from a description.
 * Removes common words, normalizes case, and filters short tokens.
 */
function extractTokens(description: string): string[] {
  const stopwords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'payment',
    'direct',
    'debit',
    'credit',
    'transfer',
    'ref',
    'reference',
    'card',
    'visa',
    'mastercard',
    'ltd',
    'limited',
    'plc',
    'inc',
    'co',
    'uk',
    'com',
    'www',
  ]);

  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove special characters
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopwords.has(token))
    .slice(0, 10); // Limit to first 10 meaningful tokens
}

/**
 * Calculate similarity between two token sets.
 * Uses Jaccard similarity with weighting for exact matches.
 */
function calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const arr1 = Array.from(set1);
  const arr2 = Array.from(set2);

  let exactMatches = 0;
  let partialMatches = 0;

  for (const token of arr1) {
    if (set2.has(token)) {
      exactMatches++;
    } else {
      // Check for partial matches (one token contains another)
      for (const t2 of arr2) {
        if (token.includes(t2) || t2.includes(token)) {
          partialMatches++;
          break;
        }
      }
    }
  }

  // Weighted score: exact matches worth more than partial
  const score = (exactMatches * 2 + partialMatches) / (set1.size + set2.size);
  return Math.min(1, score);
}

/**
 * Find similar transactions for multiple descriptions (batch operation).
 */
export async function findSimilarBatch(
  descriptions: string[],
  limit: number = 3
): Promise<Map<number, SimilarMatch[]>> {
  const results = new Map<number, SimilarMatch[]>();

  // For efficiency, we could batch this with a single RPC call
  // For now, we'll do individual lookups with caching
  for (let i = 0; i < descriptions.length; i++) {
    const similar = await findSimilarTransactions(descriptions[i], limit);
    results.set(i, similar);
  }

  return results;
}

/**
 * Get the most common category from similar transactions.
 * Useful for determining confidence when multiple similar transactions exist.
 */
export function getMostCommonCategory(
  matches: SimilarMatch[]
): { categoryId: string; categoryName: string; count: number; avgSimilarity: number } | null {
  if (matches.length === 0) {
    return null;
  }

  // Group by category
  const categories = new Map<
    string,
    { categoryName: string; count: number; totalSimilarity: number }
  >();

  for (const match of matches) {
    const existing = categories.get(match.categoryId);
    if (existing) {
      existing.count++;
      existing.totalSimilarity += match.similarity;
    } else {
      categories.set(match.categoryId, {
        categoryName: match.categoryName,
        count: 1,
        totalSimilarity: match.similarity,
      });
    }
  }

  // Find most common
  let best: { categoryId: string; categoryName: string; count: number; avgSimilarity: number } | null =
    null;

  Array.from(categories.entries()).forEach(([categoryId, data]) => {
    const avgSimilarity = data.totalSimilarity / data.count;
    if (!best || data.count > best.count || (data.count === best.count && avgSimilarity > best.avgSimilarity)) {
      best = {
        categoryId,
        categoryName: data.categoryName,
        count: data.count,
        avgSimilarity,
      };
    }
  });

  return best;
}
