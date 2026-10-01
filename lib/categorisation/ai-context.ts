/**
 * AI prompt context
 *
 * What Claude needs to categorise like Chris does, not just plausibly:
 * - settled precedents for each transaction (from the similarity lookup),
 * - recent corrections Chris made to similar descriptions,
 * - the active policy rules, in plain English.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { normaliseDescription } from './normalise';
import { getRules, isPolicyRule, type RuleRecord } from './rule-matcher';
import type { SimilarMatch } from './similar-lookup';

export interface PrecedentExample {
  description: string;
  categoryName: string;
  similarity: number;
  date: string;
}

export interface CorrectionExample {
  description: string;
  fromCategory: string | null;
  toCategory: string;
  createdAt: string;
}

export interface AIPromptContext {
  /** Per transaction (same order as the batch): up to 5 settled precedents. */
  precedents: PrecedentExample[][];
  /** Up to 20 recent corrections to descriptions similar to any in the batch. */
  corrections: CorrectionExample[];
  /** Policy rules as plain-English lines. */
  policies: string[];
}

const CONTEXT_CONFIG = {
  maxPrecedents: 5,
  maxCorrections: 20,
  correctionLookbackDays: 365,
  correctionScanLimit: 500,
  correctionSimilarity: 0.4,
};

// =============================================================================
// PURE HELPERS
// =============================================================================

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.split(' ').filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** pg_trgm-style similarity on normalised descriptions (0–1). */
export function descriptionSimilarity(a: string, b: string): number {
  const ta = trigrams(normaliseDescription(a));
  const tb = trigrams(normaliseDescription(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return shared / (ta.size + tb.size - shared);
}

/** Pick corrections relevant to any description in the batch, newest first. */
export function selectRelevantCorrections(
  descriptions: string[],
  corrections: CorrectionExample[],
  limit = CONTEXT_CONFIG.maxCorrections
): CorrectionExample[] {
  return corrections
    .filter((c) =>
      descriptions.some((d) => descriptionSimilarity(d, c.description) >= CONTEXT_CONFIG.correctionSimilarity)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

function money(v: number | string | null | undefined): string {
  return `£${Number(v).toFixed(2)}`;
}

/** One plain-English line per policy rule. */
export function describePolicy(rule: RuleRecord, accountNames: Map<string, string>): string {
  const conds: string[] = [];
  if (rule.amount_sign === 'credit') conds.push('money in');
  if (rule.amount_sign === 'debit') conds.push('money out');
  const min = rule.amount_min ?? null;
  const max = rule.amount_max ?? null;
  if (min !== null && max !== null && Number(min) === Number(max)) conds.push(`amount exactly ${money(min)}`);
  else {
    if (min !== null) conds.push(`amount ≥ ${money(min)}`);
    if (max !== null) conds.push(`amount ≤ ${money(max)}`);
  }
  if (rule.account_id) conds.push(`on ${accountNames.get(rule.account_id) ?? 'a specific account'}`);
  const when = conds.length ? ` (${conds.join(', ')})` : '';
  const category = rule.categories?.name ?? 'Unknown';
  return rule.action === 'ask'
    ? `- "${rule.pattern}"${when} → always flag for Chris (suggest ${category})`
    : `- "${rule.pattern}"${when} → ${category}`;
}

// =============================================================================
// DATA ACCESS
// =============================================================================

interface CorrectionRow {
  description: string;
  created_at: string | null;
  corrected_category: { name: string } | null;
  original_category: { name: string } | null;
}

async function fetchRecentCorrections(): Promise<CorrectionExample[]> {
  const since = new Date(Date.now() - CONTEXT_CONFIG.correctionLookbackDays * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('category_corrections')
    .select(
      'description, created_at, corrected_category:corrected_category_id(name), original_category:original_category_id(name)'
    )
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(CONTEXT_CONFIG.correctionScanLimit);
  if (error) {
    console.warn('AI context: failed to read corrections:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as CorrectionRow[])
    .filter((r) => r.corrected_category?.name)
    .map((r) => ({
      description: r.description,
      fromCategory: r.original_category?.name ?? null,
      toCategory: r.corrected_category!.name,
      createdAt: r.created_at ?? '',
    }));
}

async function fetchAccountNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('accounts').select('id, name').in('id', ids);
  return new Map((data ?? []).map((a) => [a.id, a.name]));
}

/**
 * Build the prompt context for a batch. Never throws — a failed lookup just
 * means less context.
 */
export async function buildAIContext(
  items: { description: string; similar: SimilarMatch[] }[]
): Promise<AIPromptContext> {
  const precedents = items.map((it) =>
    it.similar.slice(0, CONTEXT_CONFIG.maxPrecedents).map((m) => ({
      description: m.description,
      categoryName: m.categoryName,
      similarity: m.similarity,
      date: m.date,
    }))
  );

  let corrections: CorrectionExample[] = [];
  let policies: string[] = [];
  try {
    const [allCorrections, rules] = await Promise.all([fetchRecentCorrections(), getRules()]);
    corrections = selectRelevantCorrections(
      items.map((i) => i.description),
      allCorrections
    );
    const policyRules = rules.filter(isPolicyRule);
    const accountNames = await fetchAccountNames(
      Array.from(new Set(policyRules.map((r) => r.account_id).filter((x): x is string => Boolean(x))))
    );
    policies = policyRules.map((r) => describePolicy(r, accountNames));
  } catch (e) {
    console.warn('AI context: partial context only:', e instanceof Error ? e.message : e);
  }

  return { precedents, corrections, policies };
}
