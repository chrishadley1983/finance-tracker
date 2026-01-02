/**
 * Rule Matcher
 *
 * Matches transaction descriptions against category_mappings rules.
 * Supports exact, contains, and regex match types.
 */

import { supabaseAdmin } from '@/lib/supabase/server';

// =============================================================================
// TYPES
// =============================================================================

export interface RuleMatch {
  ruleId: string;
  categoryId: string;
  categoryName: string;
  pattern: string;
  matchType: 'exact' | 'contains' | 'regex';
  confidence: number;
}

interface CategoryMapping {
  id: string;
  pattern: string;
  category_id: string;
  match_type: 'exact' | 'contains' | 'regex';
  confidence: number;
  categories: {
    id: string;
    name: string;
  };
}

// =============================================================================
// CACHE
// =============================================================================

// Simple in-memory cache for rules (refreshed every 5 minutes)
let rulesCache: CategoryMapping[] | null = null;
let rulesCacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getRules(): Promise<CategoryMapping[]> {
  const now = Date.now();

  if (rulesCache && now - rulesCacheTimestamp < CACHE_TTL) {
    return rulesCache;
  }

  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .select(
      `
      id,
      pattern,
      category_id,
      match_type,
      confidence,
      categories (
        id,
        name
      )
    `
    )
    .order('confidence', { ascending: false });

  if (error) {
    console.error('Failed to fetch category mappings:', error);
    return rulesCache || [];
  }

  rulesCache = data as unknown as CategoryMapping[];
  rulesCacheTimestamp = now;
  return rulesCache;
}

/**
 * Clear the rules cache (useful after rule changes).
 */
export function clearRulesCache(): void {
  rulesCache = null;
  rulesCacheTimestamp = 0;
}

// =============================================================================
// MATCHING FUNCTIONS
// =============================================================================

/**
 * Match a description against exact match rules.
 * Case-insensitive comparison.
 */
export async function matchExactRule(description: string): Promise<RuleMatch | null> {
  const rules = await getRules();
  const normalizedDesc = description.toLowerCase().trim();

  for (const rule of rules) {
    if (rule.match_type !== 'exact') continue;

    const normalizedPattern = rule.pattern.toLowerCase().trim();
    if (normalizedDesc === normalizedPattern) {
      return {
        ruleId: rule.id,
        categoryId: rule.category_id,
        categoryName: rule.categories?.name || 'Unknown',
        pattern: rule.pattern,
        matchType: 'exact',
        confidence: Number(rule.confidence),
      };
    }
  }

  return null;
}

/**
 * Match a description against pattern rules (contains or regex).
 * Returns the highest confidence match.
 */
export async function matchPatternRule(description: string): Promise<RuleMatch | null> {
  const rules = await getRules();
  const normalizedDesc = description.toLowerCase().trim();

  let bestMatch: RuleMatch | null = null;

  for (const rule of rules) {
    if (rule.match_type === 'exact') continue;

    let isMatch = false;

    if (rule.match_type === 'contains') {
      const normalizedPattern = rule.pattern.toLowerCase().trim();
      isMatch = normalizedDesc.includes(normalizedPattern);
    } else if (rule.match_type === 'regex') {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        isMatch = regex.test(description);
      } catch {
        // Invalid regex pattern - skip
        console.warn(`Invalid regex pattern in rule ${rule.id}: ${rule.pattern}`);
        continue;
      }
    }

    if (isMatch) {
      const match: RuleMatch = {
        ruleId: rule.id,
        categoryId: rule.category_id,
        categoryName: rule.categories?.name || 'Unknown',
        pattern: rule.pattern,
        matchType: rule.match_type,
        confidence: Number(rule.confidence),
      };

      // Keep highest confidence match
      if (!bestMatch || match.confidence > bestMatch.confidence) {
        bestMatch = match;
      }
    }
  }

  return bestMatch;
}

/**
 * Match a description against all rules (exact first, then patterns).
 * Returns the best match considering priority: exact > contains > regex.
 */
export async function matchRule(description: string): Promise<RuleMatch | null> {
  // Try exact match first (highest priority)
  const exactMatch = await matchExactRule(description);
  if (exactMatch) {
    return exactMatch;
  }

  // Fall back to pattern matching
  return matchPatternRule(description);
}

/**
 * Match multiple descriptions against rules (batch operation).
 * More efficient than calling matchRule for each description.
 */
export async function matchRulesBatch(
  descriptions: string[]
): Promise<Map<number, RuleMatch | null>> {
  const rules = await getRules();
  const results = new Map<number, RuleMatch | null>();

  // Separate rules by type for efficient matching
  const exactRules = rules.filter((r) => r.match_type === 'exact');
  const containsRules = rules.filter((r) => r.match_type === 'contains');
  const regexRules = rules.filter((r) => r.match_type === 'regex');

  // Compile regex patterns once
  const compiledRegexes = regexRules
    .map((rule) => {
      try {
        return { rule, regex: new RegExp(rule.pattern, 'i') };
      } catch {
        return null;
      }
    })
    .filter((r): r is { rule: CategoryMapping; regex: RegExp } => r !== null);

  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i];
    const normalizedDesc = description.toLowerCase().trim();
    let match: RuleMatch | null = null;

    // Try exact match first
    for (const rule of exactRules) {
      if (normalizedDesc === rule.pattern.toLowerCase().trim()) {
        match = {
          ruleId: rule.id,
          categoryId: rule.category_id,
          categoryName: rule.categories?.name || 'Unknown',
          pattern: rule.pattern,
          matchType: 'exact',
          confidence: Number(rule.confidence),
        };
        break;
      }
    }

    // Try contains match
    if (!match) {
      for (const rule of containsRules) {
        if (normalizedDesc.includes(rule.pattern.toLowerCase().trim())) {
          const candidate: RuleMatch = {
            ruleId: rule.id,
            categoryId: rule.category_id,
            categoryName: rule.categories?.name || 'Unknown',
            pattern: rule.pattern,
            matchType: 'contains',
            confidence: Number(rule.confidence),
          };
          if (!match || candidate.confidence > match.confidence) {
            match = candidate;
          }
        }
      }
    }

    // Try regex match
    if (!match) {
      for (const { rule, regex } of compiledRegexes) {
        if (regex.test(description)) {
          const candidate: RuleMatch = {
            ruleId: rule.id,
            categoryId: rule.category_id,
            categoryName: rule.categories?.name || 'Unknown',
            pattern: rule.pattern,
            matchType: 'regex',
            confidence: Number(rule.confidence),
          };
          if (!match || candidate.confidence > match.confidence) {
            match = candidate;
          }
        }
      }
    }

    results.set(i, match);
  }

  return results;
}
