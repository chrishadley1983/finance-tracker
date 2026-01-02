/**
 * Category Learning System
 *
 * Tracks user corrections to auto-categorisations and analyzes patterns
 * to suggest new rules.
 *
 * Flow:
 * 1. User imports transactions → auto-categorisation happens
 * 2. User corrects some categories → recordCorrection() is called
 * 3. After 3+ similar corrections → suggestion triggers via analyseCorrections()
 * 4. User approves → rule created via rules-manager
 */

import { supabaseAdmin } from '@/lib/supabase/server';

// =============================================================================
// TYPES
// =============================================================================

export interface Correction {
  description: string;
  originalCategoryId: string | null;
  correctedCategoryId: string;
  originalSource: string | null;
  importSessionId?: string;
}

export interface CorrectionRecord {
  id: string;
  description: string;
  original_category_id: string | null;
  corrected_category_id: string;
  original_source: string | null;
  import_session_id: string | null;
  created_rule_id: string | null;
  created_at: string;
  corrected_category?: {
    id: string;
    name: string;
  };
  original_category?: {
    id: string;
    name: string;
  } | null;
}

export interface PatternSuggestion {
  pattern: string;
  matchType: 'exact' | 'contains';
  categoryId: string;
  categoryName: string;
  correctionCount: number;
  sampleDescriptions: string[];
  confidence: number;
}

export interface AnalysisResult {
  suggestions: PatternSuggestion[];
  totalCorrections: number;
  recentCorrections: CorrectionRecord[];
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const LEARNING_CONFIG = {
  minCorrectionsForSuggestion: 3, // Minimum corrections before suggesting a rule
  maxSampleDescriptions: 5, // Max examples to show in suggestion
  defaultConfidence: 0.85, // Default confidence for learned rules
  lookbackDays: 90, // How far back to look for patterns
};

// =============================================================================
// CORRECTION RECORDING
// =============================================================================

/**
 * Record a user correction to an auto-categorisation.
 * Called when user changes a transaction's category during import review.
 */
export async function recordCorrection(correction: Correction): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('category_corrections')
    .insert({
      description: correction.description,
      original_category_id: correction.originalCategoryId,
      corrected_category_id: correction.correctedCategoryId,
      original_source: correction.originalSource,
      import_session_id: correction.importSessionId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to record correction:', error);
    return null;
  }

  return { id: data.id };
}

/**
 * Record multiple corrections in a batch.
 * More efficient when user makes many changes.
 */
export async function recordCorrectionsBatch(
  corrections: Correction[]
): Promise<{ recorded: number; failed: number }> {
  if (corrections.length === 0) {
    return { recorded: 0, failed: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from('category_corrections')
    .insert(
      corrections.map((c) => ({
        description: c.description,
        original_category_id: c.originalCategoryId,
        corrected_category_id: c.correctedCategoryId,
        original_source: c.originalSource,
        import_session_id: c.importSessionId || null,
      }))
    )
    .select('id');

  if (error) {
    console.error('Failed to record corrections batch:', error);
    return { recorded: 0, failed: corrections.length };
  }

  return { recorded: data?.length || 0, failed: corrections.length - (data?.length || 0) };
}

// =============================================================================
// PATTERN ANALYSIS
// =============================================================================

/**
 * Analyze recent corrections to find patterns and suggest rules.
 * Looks for descriptions that were frequently corrected to the same category.
 */
export async function analyseCorrections(): Promise<AnalysisResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LEARNING_CONFIG.lookbackDays);

  // Fetch recent corrections that haven't resulted in rules yet
  const { data: corrections, error } = await supabaseAdmin
    .from('category_corrections')
    .select(
      `
      id,
      description,
      original_category_id,
      corrected_category_id,
      original_source,
      import_session_id,
      created_rule_id,
      created_at,
      corrected_category:corrected_category_id(id, name),
      original_category:original_category_id(id, name)
    `
    )
    .gte('created_at', cutoffDate.toISOString())
    .is('created_rule_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch corrections:', error);
    return { suggestions: [], totalCorrections: 0, recentCorrections: [] };
  }

  const typedCorrections = corrections as unknown as CorrectionRecord[];
  const suggestions = findPatterns(typedCorrections);

  return {
    suggestions,
    totalCorrections: typedCorrections.length,
    recentCorrections: typedCorrections.slice(0, 10),
  };
}

/**
 * Find patterns in corrections that could become rules.
 * Uses two strategies:
 * 1. Exact match: same description corrected 3+ times to same category
 * 2. Contains: common substring in descriptions corrected to same category
 */
export function findPatterns(corrections: CorrectionRecord[]): PatternSuggestion[] {
  const suggestions: PatternSuggestion[] = [];

  // Group corrections by corrected category
  const byCategoryId = new Map<string, CorrectionRecord[]>();
  for (const correction of corrections) {
    const existing = byCategoryId.get(correction.corrected_category_id) || [];
    existing.push(correction);
    byCategoryId.set(correction.corrected_category_id, existing);
  }

  // Strategy 1: Look for exact matches (same description)
  for (const [categoryId, categoryCorrections] of Array.from(byCategoryId.entries())) {
    const byDescription = new Map<string, CorrectionRecord[]>();

    for (const correction of categoryCorrections) {
      const normalizedDesc = correction.description.toLowerCase().trim();
      const existing = byDescription.get(normalizedDesc) || [];
      existing.push(correction);
      byDescription.set(normalizedDesc, existing);
    }

    for (const [normalizedDesc, matches] of Array.from(byDescription.entries())) {
      if (matches.length >= LEARNING_CONFIG.minCorrectionsForSuggestion) {
        const firstMatch = matches[0];
        const categoryName =
          (firstMatch.corrected_category as { id: string; name: string } | undefined)?.name ||
          'Unknown';

        suggestions.push({
          pattern: matches[0].description, // Use original case
          matchType: 'exact',
          categoryId,
          categoryName,
          correctionCount: matches.length,
          sampleDescriptions: matches
            .slice(0, LEARNING_CONFIG.maxSampleDescriptions)
            .map((m: CorrectionRecord) => m.description),
          confidence: Math.min(
            0.95,
            LEARNING_CONFIG.defaultConfidence + 0.02 * (matches.length - 3)
          ),
        });
      }
    }
  }

  // Strategy 2: Look for common substrings (contains patterns)
  for (const [categoryId, categoryCorrections] of Array.from(byCategoryId.entries())) {
    if (categoryCorrections.length < LEARNING_CONFIG.minCorrectionsForSuggestion) {
      continue;
    }

    // Find common words/phrases across descriptions
    const commonPatterns = findCommonSubstrings(categoryCorrections.map((c: CorrectionRecord) => c.description));

    for (const patternInfo of commonPatterns) {
      // Don't suggest if already covered by exact match
      const alreadyCovered = suggestions.some(
        (s) =>
          s.categoryId === categoryId &&
          s.matchType === 'exact' &&
          s.pattern.toLowerCase().includes(patternInfo.pattern.toLowerCase())
      );

      if (!alreadyCovered && patternInfo.count >= LEARNING_CONFIG.minCorrectionsForSuggestion) {
        const firstCorrection = categoryCorrections[0];
        const categoryName =
          (firstCorrection.corrected_category as { id: string; name: string } | undefined)?.name ||
          'Unknown';

        suggestions.push({
          pattern: patternInfo.pattern,
          matchType: 'contains',
          categoryId,
          categoryName,
          correctionCount: patternInfo.count,
          sampleDescriptions: patternInfo.samples.slice(0, LEARNING_CONFIG.maxSampleDescriptions),
          // Contains rules have slightly lower confidence
          confidence: Math.min(
            0.9,
            LEARNING_CONFIG.defaultConfidence - 0.05 + 0.02 * (patternInfo.count - 3)
          ),
        });
      }
    }
  }

  // Sort by correction count (most evidence first)
  return suggestions.sort((a, b) => b.correctionCount - a.correctionCount);
}

/**
 * Find common substrings across multiple descriptions.
 * Used to identify potential "contains" patterns.
 */
function findCommonSubstrings(
  descriptions: string[]
): { pattern: string; count: number; samples: string[] }[] {
  if (descriptions.length < LEARNING_CONFIG.minCorrectionsForSuggestion) {
    return [];
  }

  // Extract significant words/phrases (3+ chars, not common words)
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'ref',
    'gbp',
    'usd',
    'eur',
    'payment',
    'card',
    'debit',
    'credit',
  ]);

  const patternCounts = new Map<string, { count: number; samples: string[] }>();

  for (const description of descriptions) {
    // Split into words and clean
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    // Extract unique patterns from this description
    const seenPatterns = new Set<string>();

    // Single words
    for (const word of words) {
      if (!seenPatterns.has(word)) {
        seenPatterns.add(word);
        const existing = patternCounts.get(word) || { count: 0, samples: [] };
        existing.count++;
        if (existing.samples.length < LEARNING_CONFIG.maxSampleDescriptions) {
          existing.samples.push(description);
        }
        patternCounts.set(word, existing);
      }
    }

    // Two-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (!seenPatterns.has(phrase)) {
        seenPatterns.add(phrase);
        const existing = patternCounts.get(phrase) || { count: 0, samples: [] };
        existing.count++;
        if (existing.samples.length < LEARNING_CONFIG.maxSampleDescriptions) {
          existing.samples.push(description);
        }
        patternCounts.set(phrase, existing);
      }
    }
  }

  // Filter to patterns appearing in enough descriptions
  const results: { pattern: string; count: number; samples: string[] }[] = [];

  for (const [pattern, data] of Array.from(patternCounts.entries())) {
    // Require pattern to appear in at least 50% of descriptions
    if (
      data.count >= LEARNING_CONFIG.minCorrectionsForSuggestion &&
      data.count >= descriptions.length * 0.5
    ) {
      results.push({
        pattern,
        count: data.count,
        samples: data.samples,
      });
    }
  }

  // Sort by count descending, prefer longer patterns
  return results.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.pattern.length - a.pattern.length;
  });
}

// =============================================================================
// SUGGESTION CHECKING
// =============================================================================

/**
 * Check if there are any pending suggestions for the user.
 * Used to show notification prompts.
 */
export async function checkForSuggestions(): Promise<{
  hasSuggestions: boolean;
  count: number;
}> {
  const analysis = await analyseCorrections();

  return {
    hasSuggestions: analysis.suggestions.length > 0,
    count: analysis.suggestions.length,
  };
}

/**
 * Get corrections for a specific description.
 * Used to check if a rule suggestion should be shown.
 */
export async function getCorrectionsForDescription(
  description: string
): Promise<CorrectionRecord[]> {
  const normalizedDesc = description.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('category_corrections')
    .select(
      `
      id,
      description,
      original_category_id,
      corrected_category_id,
      original_source,
      import_session_id,
      created_rule_id,
      created_at,
      corrected_category:corrected_category_id(id, name)
    `
    )
    .is('created_rule_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch corrections for description:', error);
    return [];
  }

  // Filter to matching descriptions (case-insensitive)
  return (data as unknown as CorrectionRecord[]).filter(
    (c) => c.description.toLowerCase().trim() === normalizedDesc
  );
}

/**
 * Mark corrections as having resulted in a rule.
 * Called after a rule is created from suggestions.
 */
export async function markCorrectionsAsProcessed(
  correctionIds: string[],
  ruleId: string
): Promise<boolean> {
  if (correctionIds.length === 0) return true;

  const { error } = await supabaseAdmin
    .from('category_corrections')
    .update({ created_rule_id: ruleId })
    .in('id', correctionIds);

  if (error) {
    console.error('Failed to mark corrections as processed:', error);
    return false;
  }

  return true;
}
