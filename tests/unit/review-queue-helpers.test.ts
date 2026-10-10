import { describe, it, expect } from 'vitest';
import { groupByMerchant, reasonFor, isUnsure, type ReviewRow } from '@/lib/review/queue';

const row = (p: Partial<ReviewRow>): ReviewRow => ({
  id: Math.random().toString(36),
  date: '2026-10-01',
  description: 'X',
  amount: -10,
  accountId: 'a',
  accountName: 'A',
  categoryId: null,
  categoryName: null,
  needsReview: true,
  isValidated: false,
  categorisationSource: 'import',
  confidence: null,
  engineSource: null,
  merchant: 'x',
  suggestion: null,
  reason: '',
  ...p,
});
const sug = (id: string) => ({ categoryId: id, categoryName: id, confidence: 0.9, source: 'similar' });

describe('review queue helpers', () => {
  it('groups by merchant, biggest group first, with a shared suggestion only when all agree', () => {
    const g = groupByMerchant([
      row({ merchant: 'amazon', suggestion: sug('stock') }),
      row({ merchant: 'tesco', suggestion: sug('groc'), amount: -5 }),
      row({ merchant: 'tesco', suggestion: sug('groc'), amount: -7 }),
      row({ merchant: 'amazon', suggestion: sug('subs') }),
      row({ merchant: 'tesco', suggestion: sug('groc'), amount: -1 }),
    ]);
    expect(g.map((x) => [x.label, x.rows.length])).toEqual([['Tesco', 3], ['Amazon', 2]]);
    expect(g[0].sharedSuggestion?.categoryId).toBe('groc');
    expect(g[0].total).toBe(-13);
    expect(g[1].sharedSuggestion).toBeNull();
  });

  it('explains why each row is here', () => {
    expect(reasonFor({ categoryId: null, needsReview: true, engineSource: null, confidence: null, suggestion: null })).toBe('No rule or past match');
    expect(reasonFor({ categoryId: 'c', needsReview: true, engineSource: 'policy_ask', confidence: 0.99, suggestion: sug('c') })).toBe('Your rule says always ask');
    expect(reasonFor({ categoryId: 'c', needsReview: true, engineSource: 'ai', confidence: 0.5, suggestion: sug('c') })).toBe('AI guess, not sure');
    expect(reasonFor({ categoryId: 'c', needsReview: true, engineSource: 'manual', confidence: 1, suggestion: sug('c') })).toBe('Flagged for a check');
  });

  it('only calls low confidence "unsure"', () => {
    expect(isUnsure(0.5)).toBe(true);
    expect(isUnsure(0.95)).toBe(false);
    expect(isUnsure(null)).toBe(false);
  });
});
