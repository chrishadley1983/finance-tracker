/**
 * Rules Manager
 *
 * CRUD operations for category_mappings (rules).
 * Handles rule creation, updating, deletion, and testing.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { clearRulesCache } from './rule-matcher';
import { markCorrectionsAsProcessed, type PatternSuggestion } from './learning';

// =============================================================================
// TYPES
// =============================================================================

export interface Rule {
  id: string;
  pattern: string;
  category_id: string;
  match_type: 'exact' | 'contains' | 'regex';
  confidence: number;
  is_system: boolean;
  notes: string | null;
  created_at: string;
  category?: {
    id: string;
    name: string;
    group_name: string | null;
  };
}

export interface CreateRuleInput {
  pattern: string;
  categoryId: string;
  matchType: 'exact' | 'contains' | 'regex';
  confidence?: number;
  isSystem?: boolean;
  notes?: string;
}

export interface UpdateRuleInput {
  pattern?: string;
  categoryId?: string;
  matchType?: 'exact' | 'contains' | 'regex';
  confidence?: number;
  notes?: string;
}

export interface RuleTestResult {
  totalMatched: number;
  transactions: {
    id: string;
    date: string;
    description: string;
    amount: number;
    currentCategoryId: string | null;
    currentCategoryName: string | null;
  }[];
  wouldChange: number;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get all rules with their categories.
 */
export async function getRules(options?: {
  isSystem?: boolean;
  categoryId?: string;
}): Promise<Rule[]> {
  let query = supabaseAdmin.from('category_mappings').select(
    `
      id,
      pattern,
      category_id,
      match_type,
      confidence,
      is_system,
      notes,
      created_at,
      category:category_id(id, name, group_name)
    `
  );

  if (options?.isSystem !== undefined) {
    query = query.eq('is_system', options.isSystem);
  }

  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch rules:', error);
    return [];
  }

  return data as unknown as Rule[];
}

/**
 * Get a single rule by ID.
 */
export async function getRule(id: string): Promise<Rule | null> {
  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .select(
      `
      id,
      pattern,
      category_id,
      match_type,
      confidence,
      is_system,
      notes,
      created_at,
      category:category_id(id, name, group_name)
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('Failed to fetch rule:', error);
    return null;
  }

  return data as unknown as Rule;
}

/**
 * Create a new rule.
 * Clears the rules cache after creation.
 */
export async function createRule(input: CreateRuleInput): Promise<Rule | null> {
  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .insert({
      pattern: input.pattern,
      category_id: input.categoryId,
      match_type: input.matchType,
      confidence: input.confidence ?? 0.85,
      is_system: input.isSystem ?? false,
      notes: input.notes ?? null,
    })
    .select(
      `
      id,
      pattern,
      category_id,
      match_type,
      confidence,
      is_system,
      notes,
      created_at,
      category:category_id(id, name, group_name)
    `
    )
    .single();

  if (error) {
    console.error('Failed to create rule:', error);
    return null;
  }

  clearRulesCache();
  return data as unknown as Rule;
}

/**
 * Create a rule from a suggestion, marking the related corrections as processed.
 */
export async function createRuleFromSuggestion(
  suggestion: PatternSuggestion,
  correctionIds: string[],
  notes?: string
): Promise<Rule | null> {
  const rule = await createRule({
    pattern: suggestion.pattern,
    categoryId: suggestion.categoryId,
    matchType: suggestion.matchType,
    confidence: suggestion.confidence,
    notes: notes || `Created from ${suggestion.correctionCount} user corrections`,
  });

  if (rule && correctionIds.length > 0) {
    await markCorrectionsAsProcessed(correctionIds, rule.id);
  }

  return rule;
}

/**
 * Update an existing rule.
 * Clears the rules cache after update.
 */
export async function updateRule(id: string, input: UpdateRuleInput): Promise<Rule | null> {
  const updates: Record<string, unknown> = {};

  if (input.pattern !== undefined) updates.pattern = input.pattern;
  if (input.categoryId !== undefined) updates.category_id = input.categoryId;
  if (input.matchType !== undefined) updates.match_type = input.matchType;
  if (input.confidence !== undefined) updates.confidence = input.confidence;
  if (input.notes !== undefined) updates.notes = input.notes;

  if (Object.keys(updates).length === 0) {
    return getRule(id);
  }

  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .update(updates)
    .eq('id', id)
    .select(
      `
      id,
      pattern,
      category_id,
      match_type,
      confidence,
      is_system,
      notes,
      created_at,
      category:category_id(id, name, group_name)
    `
    )
    .single();

  if (error) {
    console.error('Failed to update rule:', error);
    return null;
  }

  clearRulesCache();
  return data as unknown as Rule;
}

/**
 * Delete a rule.
 * Clears the rules cache after deletion.
 */
export async function deleteRule(id: string): Promise<boolean> {
  // First check if it's a system rule
  const existing = await getRule(id);
  if (existing?.is_system) {
    console.error('Cannot delete system rule');
    return false;
  }

  const { error } = await supabaseAdmin.from('category_mappings').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete rule:', error);
    return false;
  }

  clearRulesCache();
  return true;
}

// =============================================================================
// RULE TESTING
// =============================================================================

/**
 * Test a rule pattern against existing transactions.
 * Shows which transactions would match and how many would change category.
 */
export async function testRule(
  pattern: string,
  matchType: 'exact' | 'contains' | 'regex',
  categoryId: string,
  limit: number = 50
): Promise<RuleTestResult> {
  // First, fetch transactions to test against
  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select(
      `
      id,
      date,
      description,
      amount,
      category_id,
      category:category_id(id, name)
    `
    )
    .order('date', { ascending: false })
    .limit(1000); // Get a reasonable sample

  if (error) {
    console.error('Failed to fetch transactions for testing:', error);
    return { totalMatched: 0, transactions: [], wouldChange: 0 };
  }

  const matchedTransactions: RuleTestResult['transactions'] = [];
  let wouldChange = 0;

  for (const tx of transactions || []) {
    const description = tx.description || '';
    let isMatch = false;

    switch (matchType) {
      case 'exact':
        isMatch = description.toLowerCase().trim() === pattern.toLowerCase().trim();
        break;
      case 'contains':
        isMatch = description.toLowerCase().includes(pattern.toLowerCase());
        break;
      case 'regex':
        try {
          const regex = new RegExp(pattern, 'i');
          isMatch = regex.test(description);
        } catch {
          // Invalid regex
          isMatch = false;
        }
        break;
    }

    if (isMatch) {
      const category = tx.category as { id: string; name: string } | null;

      matchedTransactions.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        currentCategoryId: tx.category_id,
        currentCategoryName: category?.name || null,
      });

      if (tx.category_id !== categoryId) {
        wouldChange++;
      }
    }
  }

  return {
    totalMatched: matchedTransactions.length,
    transactions: matchedTransactions.slice(0, limit),
    wouldChange,
  };
}

/**
 * Check if a pattern already exists as a rule.
 */
export async function checkPatternExists(
  pattern: string,
  matchType: 'exact' | 'contains' | 'regex'
): Promise<Rule | null> {
  const normalizedPattern = pattern.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .select(
      `
      id,
      pattern,
      category_id,
      match_type,
      confidence,
      is_system,
      notes,
      created_at,
      category:category_id(id, name, group_name)
    `
    )
    .eq('match_type', matchType);

  if (error) {
    console.error('Failed to check pattern:', error);
    return null;
  }

  // Check for matching pattern (case-insensitive)
  const existing = (data as unknown as Rule[]).find(
    (r) => r.pattern.toLowerCase().trim() === normalizedPattern
  );

  return existing || null;
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get statistics about rules.
 */
export async function getRuleStats(): Promise<{
  total: number;
  byMatchType: Record<string, number>;
  systemRules: number;
  userRules: number;
  recentlyCreated: number;
}> {
  const rules = await getRules();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const stats = {
    total: rules.length,
    byMatchType: {} as Record<string, number>,
    systemRules: 0,
    userRules: 0,
    recentlyCreated: 0,
  };

  for (const rule of rules) {
    // Count by match type
    stats.byMatchType[rule.match_type] = (stats.byMatchType[rule.match_type] || 0) + 1;

    // Count system vs user
    if (rule.is_system) {
      stats.systemRules++;
    } else {
      stats.userRules++;
    }

    // Count recently created
    if (new Date(rule.created_at) > thirtyDaysAgo) {
      stats.recentlyCreated++;
    }
  }

  return stats;
}
