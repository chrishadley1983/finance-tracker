/**
 * Rule Matcher
 *
 * Matches transactions against category_mappings rules.
 *
 * Order of precedence:
 * 1. Policy rules — `is_system`, or any rule with an account / sign / amount
 *    condition or the `ask` action. Chris's standing decisions; the most
 *    specific matching policy wins (most conditions, then confidence, then
 *    longest pattern).
 * 2. Exact rules.
 * 3. Contains rules — token-bounded against the normalised description
 *    (highest confidence, then longest pattern).
 * 4. Regex rules (raw description).
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { normaliseDescription, normalisePattern } from './normalise';

// =============================================================================
// TYPES
// =============================================================================

export type RuleAction = 'categorise' | 'ask';

export interface RuleMatch {
  ruleId: string;
  categoryId: string;
  categoryName: string;
  pattern: string;
  matchType: 'exact' | 'contains' | 'regex';
  confidence: number;
  isPolicy: boolean;
  action: RuleAction;
}

export interface RuleRecord {
  id: string;
  pattern: string;
  category_id: string;
  match_type: 'exact' | 'contains' | 'regex';
  confidence: number;
  is_system?: boolean | null;
  account_id?: string | null;
  amount_sign?: string | null;
  amount_min?: number | string | null;
  amount_max?: number | string | null;
  action?: string | null;
  notes?: string | null;
  categories: {
    id: string;
    name: string;
  } | null;
}

/** What a rule is evaluated against. Amount/account are needed for policy conditions. */
export interface RuleContext {
  description: string;
  amount?: number;
  accountId?: string | null;
}

// =============================================================================
// CACHE
// =============================================================================

// Simple in-memory cache for rules (refreshed every 5 minutes)
let rulesCache: RuleRecord[] | null = null;
let rulesCacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getRules(): Promise<RuleRecord[]> {
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
      is_system,
      account_id,
      amount_sign,
      amount_min,
      amount_max,
      action,
      notes,
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

  rulesCache = data as unknown as RuleRecord[];
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
// PURE MATCHING
// =============================================================================

const AMOUNT_EPSILON = 0.005;

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Number of conditions a rule carries (account, sign, min, max). */
export function conditionCount(rule: RuleRecord): number {
  return (
    (rule.account_id ? 1 : 0) +
    (rule.amount_sign ? 1 : 0) +
    (num(rule.amount_min) !== null ? 1 : 0) +
    (num(rule.amount_max) !== null ? 1 : 0)
  );
}

/** Policy rules are Chris's standing decisions and are evaluated first. */
export function isPolicyRule(rule: RuleRecord): boolean {
  return Boolean(rule.is_system) || rule.action === 'ask' || conditionCount(rule) > 0;
}

/** All present conditions must hold; a condition on unknown context never matches. */
export function conditionsMatch(rule: RuleRecord, ctx: RuleContext): boolean {
  if (rule.account_id) {
    if (!ctx.accountId || ctx.accountId !== rule.account_id) return false;
  }
  const needsAmount = rule.amount_sign || num(rule.amount_min) !== null || num(rule.amount_max) !== null;
  if (needsAmount) {
    if (ctx.amount === undefined || ctx.amount === null || !Number.isFinite(ctx.amount)) return false;
    if (rule.amount_sign === 'debit' && !(ctx.amount < 0)) return false;
    if (rule.amount_sign === 'credit' && !(ctx.amount > 0)) return false;
    const abs = Math.abs(ctx.amount);
    const min = num(rule.amount_min);
    const max = num(rule.amount_max);
    if (min !== null && abs < min - AMOUNT_EPSILON) return false;
    if (max !== null && abs > max + AMOUNT_EPSILON) return false;
  }
  return true;
}

interface PreparedDescription {
  raw: string;
  lower: string;
  merchant: string;
}

function prepare(description: string): PreparedDescription {
  return {
    raw: description,
    lower: description.toLowerCase().trim(),
    merchant: normaliseDescription(description),
  };
}

/** Does the rule's pattern match the description (ignoring conditions)? */
function patternMatches(rule: RuleRecord, d: PreparedDescription): boolean {
  if (rule.match_type === 'exact') {
    const p = rule.pattern.toLowerCase().trim();
    return d.lower === p || d.merchant === normalisePattern(rule.pattern);
  }
  if (rule.match_type === 'contains') {
    // Token-bounded on the normalised description only, so "aldi" can't hit
    // "vivaldi" and a legacy label like "Energy" can't hit "...ENERGYDRINK".
    const p = normalisePattern(rule.pattern);
    if (!p) return false;
    return ` ${d.merchant} `.includes(` ${p} `);
  }
  try {
    return new RegExp(rule.pattern, 'i').test(d.raw);
  } catch {
    console.warn(`Invalid regex pattern in rule ${rule.id}: ${rule.pattern}`);
    return false;
  }
}

/** Does this one rule apply to this transaction (pattern + conditions)? */
export function ruleApplies(rule: RuleRecord, ctx: RuleContext): boolean {
  return patternMatches(rule, prepare(ctx.description)) && conditionsMatch(rule, ctx);
}

function toMatch(rule: RuleRecord): RuleMatch {
  return {
    ruleId: rule.id,
    categoryId: rule.category_id,
    categoryName: rule.categories?.name || 'Unknown',
    pattern: rule.pattern,
    matchType: rule.match_type,
    confidence: Number(rule.confidence),
    isPolicy: isPolicyRule(rule),
    action: rule.action === 'ask' ? 'ask' : 'categorise',
  };
}

function better(a: RuleRecord, b: RuleRecord, byConditions: boolean): boolean {
  if (byConditions) {
    const ca = conditionCount(a);
    const cb = conditionCount(b);
    if (ca !== cb) return ca > cb;
  }
  const fa = Number(a.confidence);
  const fb = Number(b.confidence);
  if (fa !== fb) return fa > fb;
  return a.pattern.length > b.pattern.length;
}

/** Pure: pick the winning rule for a transaction, or null. */
export function selectRule(rules: RuleRecord[], ctx: RuleContext): RuleMatch | null {
  const d = prepare(ctx.description);
  let policy: RuleRecord | null = null;
  let exact: RuleRecord | null = null;
  let contains: RuleRecord | null = null;
  let regex: RuleRecord | null = null;

  for (const rule of rules) {
    if (!patternMatches(rule, d)) continue;
    if (isPolicyRule(rule)) {
      if (!conditionsMatch(rule, ctx)) continue;
      if (!policy || better(rule, policy, true)) policy = rule;
    } else if (rule.match_type === 'exact') {
      if (!exact) exact = rule;
    } else if (rule.match_type === 'contains') {
      if (!contains || better(rule, contains, false)) contains = rule;
    } else if (!regex || Number(rule.confidence) > Number(regex.confidence)) {
      regex = rule;
    }
  }

  const winner = policy ?? exact ?? contains ?? regex;
  return winner ? toMatch(winner) : null;
}

// =============================================================================
// MATCHING FUNCTIONS
// =============================================================================

function toContext(input: string | RuleContext): RuleContext {
  return typeof input === 'string' ? { description: input } : input;
}

/**
 * Match a description against exact match rules (non-policy).
 * Case-insensitive comparison.
 */
export async function matchExactRule(description: string): Promise<RuleMatch | null> {
  const rules = await getRules();
  return selectRule(
    rules.filter((r) => r.match_type === 'exact' && !isPolicyRule(r)),
    { description }
  );
}

/**
 * Match a description against pattern rules (contains or regex, non-policy).
 * Returns the highest confidence match.
 */
export async function matchPatternRule(description: string): Promise<RuleMatch | null> {
  const rules = await getRules();
  return selectRule(
    rules.filter((r) => r.match_type !== 'exact' && !isPolicyRule(r)),
    { description }
  );
}

/**
 * Match a transaction against all rules (policy → exact → contains → regex).
 */
export async function matchRule(input: string | RuleContext): Promise<RuleMatch | null> {
  const rules = await getRules();
  return selectRule(rules, toContext(input));
}

/**
 * Match multiple transactions against rules (batch operation, one rules read).
 */
export async function matchRulesBatch(
  inputs: Array<string | RuleContext>
): Promise<Map<number, RuleMatch | null>> {
  const rules = await getRules();
  const results = new Map<number, RuleMatch | null>();
  inputs.forEach((input, i) => results.set(i, selectRule(rules, toContext(input))));
  return results;
}
