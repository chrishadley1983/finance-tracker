/**
 * Apply one rule to existing transactions (Categories page).
 *
 * Only rows that still need a decision are touched: uncategorised or flagged
 * for review, and never `manual` or `is_validated` rows. Matching uses the
 * engine's own matcher (pattern + conditions), so what the preview counts is
 * what gets applied. Applying goes through applyAnswers — the same path as
 * POST /api/categorisation/answers — so the rows become confirmed manual
 * decisions with corrections recorded where an automatic guess is overridden.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { ruleApplies, type RuleRecord } from './rule-matcher';
import { applyAnswers } from './answers';

export interface ApplicableRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  needs_review: boolean | null;
}

export interface RuleApplyPreview {
  rule: { id: string; pattern: string; match_type: string; category_id: string; category_name: string | null; action: string | null };
  /** Undecided rows the rule would change. */
  eligible: number;
  /** Of those, how many have no category at all. */
  uncategorised: number;
  /** Of those, how many are in the review queue. */
  inReview: number;
  /** Up to 5 example rows, newest first. */
  sample: ApplicableRow[];
  /** False for an `ask` policy, which flags rows rather than categorising them. */
  applicable: boolean;
}

export class RuleNotFoundError extends Error {
  constructor(id: string) {
    super(`Rule ${id} not found`);
    this.name = 'RuleNotFoundError';
  }
}

interface CandidateRow extends ApplicableRow {
  account_id: string | null;
  categorisation_source: string | null;
  is_validated: boolean | null;
}

const PAGE = 1000;
const MAX_ROWS = 20000;
const ANSWER_CHUNK = 500;

async function loadRule(ruleId: string): Promise<RuleRecord & { categories: { id: string; name: string } | null }> {
  const { data, error } = await supabaseAdmin
    .from('category_mappings')
    .select(
      'id, pattern, category_id, match_type, confidence, is_system, account_id, amount_sign, amount_min, amount_max, days_of_week, action, notes, categories(id, name)'
    )
    .eq('id', ruleId)
    .single();
  if (error || !data) throw new RuleNotFoundError(ruleId);
  return data as unknown as RuleRecord & { categories: { id: string; name: string } | null };
}

/** Undecided rows: uncategorised or in review, not manual, not validated. */
async function loadUndecided(): Promise<CandidateRow[]> {
  const rows: CandidateRow[] = [];
  for (let page = 0; page * PAGE < MAX_ROWS; page++) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, date, description, amount, account_id, category_id, categorisation_source, is_validated, needs_review')
      .or('category_id.is.null,needs_review.eq.true')
      .order('date', { ascending: false })
      .order('id', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`Failed to read transactions: ${error.message}`);
    const batch = (data ?? []) as CandidateRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows.filter((r) => r.categorisation_source !== 'manual' && r.is_validated !== true);
}

async function findEligible(ruleId: string) {
  const rule = await loadRule(ruleId);
  const applicable = rule.action !== 'ask';
  const rows = applicable ? await loadUndecided() : [];
  // Every undecided row is uncategorised or in review, so a match is always a change
  // (a review row already on this category gets confirmed and leaves the queue).
  const eligible = rows.filter((r) =>
    ruleApplies(rule, { description: r.description ?? '', amount: Number(r.amount), accountId: r.account_id, date: r.date })
  );
  return { rule, applicable, eligible };
}

export async function previewRuleApply(ruleId: string): Promise<RuleApplyPreview> {
  const { rule, applicable, eligible } = await findEligible(ruleId);
  return {
    rule: {
      id: rule.id,
      pattern: rule.pattern,
      match_type: rule.match_type,
      category_id: rule.category_id,
      category_name: rule.categories?.name ?? null,
      action: rule.action ?? null,
    },
    eligible: eligible.length,
    uncategorised: eligible.filter((r) => !r.category_id).length,
    inReview: eligible.filter((r) => r.needs_review === true).length,
    sample: eligible.slice(0, 5).map(({ id, date, description, amount, category_id, needs_review }) => ({
      id,
      date,
      description,
      amount: Number(amount),
      category_id,
      needs_review,
    })),
    applicable,
  };
}

/** Re-checks eligibility server-side, then applies. Returns how many rows changed. */
export async function applyRuleToExisting(ruleId: string): Promise<{ applied: number; categoryId: string; categoryName: string | null }> {
  const { rule, applicable, eligible } = await findEligible(ruleId);
  if (!applicable || eligible.length === 0) {
    return { applied: 0, categoryId: rule.category_id, categoryName: rule.categories?.name ?? null };
  }
  const ids = eligible.map((r) => r.id);
  const answers = [];
  for (let i = 0; i < ids.length; i += ANSWER_CHUNK) {
    answers.push({ transaction_ids: ids.slice(i, i + ANSWER_CHUNK), category_id: rule.category_id });
  }
  const result = await applyAnswers(answers);
  const applied = result.results.reduce((t, r) => t + r.applied, 0);
  return { applied, categoryId: rule.category_id, categoryName: rule.categories?.name ?? null };
}
