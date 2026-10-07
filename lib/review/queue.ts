/**
 * Review queue shaping: why a row needs review, what we'd suggest, and how
 * rows group by merchant. Pure functions, shared by the API and the UI.
 */
import { CONFIDENCE_REVIEW_THRESHOLD } from '@/lib/categorisation/thresholds';

export interface Suggestion {
  categoryId: string;
  categoryName: string;
  confidence: number | null;
  source: string | null;
}

export interface ReviewRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  needsReview: boolean;
  isValidated: boolean;
  categorisationSource: 'manual' | 'rule' | 'ai' | 'import';
  confidence: number | null;
  engineSource: string | null;
  merchant: string;
  suggestion: Suggestion | null;
  reason: string;
}

const SOURCE_LABEL: Record<string, string> = {
  ai: 'AI guess',
  similar: 'Similar past transactions',
  rule_exact: 'Rule',
  rule_pattern: 'Rule',
  policy: 'Your rule',
  manual: 'Set by you',
};

export function sourceLabel(source: string | null | undefined): string {
  return (source && SOURCE_LABEL[source]) || 'Suggestion';
}

/** "unsure" only when confidence is low: high-confidence numbers are noise. */
export function isUnsure(confidence: number | null | undefined): boolean {
  return confidence !== null && confidence !== undefined && confidence < CONFIDENCE_REVIEW_THRESHOLD;
}

export function reasonFor(row: {
  categoryId: string | null;
  needsReview: boolean;
  engineSource: string | null;
  confidence: number | null;
  suggestion: Suggestion | null;
}): string {
  if (row.engineSource === 'policy_ask') return 'Your rule says always ask';
  if (!row.categoryId) {
    return row.suggestion ? `${sourceLabel(row.suggestion.source)} suggest a category` : 'No rule or past match';
  }
  if (isUnsure(row.confidence)) return `${sourceLabel(row.engineSource)}, not sure`;
  return 'Flagged for a check';
}

export interface MerchantGroup {
  merchant: string;
  label: string;
  rows: ReviewRow[];
  total: number;
  /** The suggested category every row shares, if they all agree. */
  sharedSuggestion: Suggestion | null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupByMerchant(rows: ReviewRow[]): MerchantGroup[] {
  const map = new Map<string, ReviewRow[]>();
  for (const r of rows) {
    const k = r.merchant || r.description.toLowerCase();
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  const groups = Array.from(map, ([merchant, list]) => {
    const first = list[0].suggestion;
    const shared = first && list.every((r) => r.suggestion?.categoryId === first.categoryId) ? first : null;
    return {
      merchant,
      label: titleCase(merchant),
      rows: list,
      total: list.reduce((t, r) => t + r.amount, 0),
      sharedSuggestion: shared,
    };
  });
  // Biggest groups first: one decision clears the most rows.
  return groups.sort((a, b) => b.rows.length - a.rows.length || (a.rows[0].date < b.rows[0].date ? 1 : -1));
}
