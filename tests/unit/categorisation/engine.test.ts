import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/categorisation/rule-matcher', () => ({
  matchRulesBatch: vi.fn(),
  clearRulesCache: vi.fn(),
}));

vi.mock('@/lib/categorisation/similar-lookup', () => ({
  findSimilarTransactions: vi.fn(),
  getMostCommonCategory: vi.fn(),
}));

vi.mock('@/lib/categorisation/ai-categoriser', () => ({
  categoriseBatchWithAI: vi.fn(),
  checkAIAvailability: vi.fn(),
  trackAIUsage: vi.fn(),
  clearCategoriesCache: vi.fn(),
}));

vi.mock('@/lib/categorisation/ai-context', () => ({
  buildAIContext: vi.fn(async (items: unknown[]) => ({ precedents: items.map(() => []), corrections: [], policies: [] })),
}));

import {
  categoriseTransaction,
  categoriseMultiple,
  calculateStats,
  toTransactionCategoryFields,
  type CategorisationResult,
} from '@/lib/categorisation/engine';
import { matchRulesBatch, type RuleMatch } from '@/lib/categorisation/rule-matcher';
import { findSimilarTransactions, getMostCommonCategory, type SimilarMatch } from '@/lib/categorisation/similar-lookup';
import { categoriseBatchWithAI, checkAIAvailability, trackAIUsage } from '@/lib/categorisation/ai-categoriser';
import { buildAIContext } from '@/lib/categorisation/ai-context';

function ruleMatch(partial: Partial<RuleMatch>): RuleMatch {
  return {
    ruleId: 'rule-1',
    categoryId: 'cat-groceries',
    categoryName: 'Groceries',
    pattern: 'tesco',
    matchType: 'contains',
    confidence: 0.9,
    isPolicy: false,
    action: 'categorise',
    ...partial,
  };
}

function similar(categoryId: string, similarity: number, description = 'TESCO STORES'): SimilarMatch {
  return { transactionId: `t-${Math.random()}`, description, categoryId, categoryName: categoryId, similarity, date: '2026-09-01' };
}

function rulesFor(matches: (RuleMatch | null)[]) {
  vi.mocked(matchRulesBatch).mockResolvedValue(new Map(matches.map((m, i) => [i, m])));
}

/** Mirror of similar-lookup's majority helper. */
function realMostCommon(ms: SimilarMatch[]) {
  const counts = new Map<string, number>();
  for (const m of ms) counts.set(m.categoryId, (counts.get(m.categoryId) ?? 0) + 1);
  let best: { categoryId: string; categoryName: string; count: number } | null = null;
  counts.forEach((count, categoryId) => {
    if (!best || count > best.count) best = { categoryId, categoryName: categoryId, count };
  });
  return best;
}

const tx = (description: string, amount = -10, accountId = 'acct-joint') => ({ date: '2026-09-30', description, amount, accountId });

describe('Categorisation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findSimilarTransactions).mockResolvedValue([]);
    vi.mocked(getMostCommonCategory).mockImplementation(realMostCommon as never);
    vi.mocked(checkAIAvailability).mockResolvedValue({ available: true, remaining: 100, dailyLimit: 100 });
    vi.mocked(categoriseBatchWithAI).mockResolvedValue(new Map());
  });

  describe('rules', () => {
    it('passes amount and account to the rule matcher (policies need them)', async () => {
      rulesFor([ruleMatch({})]);
      await categoriseMultiple([tx('TESCO', -12.5, 'acct-1')]);
      expect(matchRulesBatch).toHaveBeenCalledWith([{ description: 'TESCO', amount: -12.5, accountId: 'acct-1' }]);
    });

    it('exact and pattern rules map to rule_exact / rule_pattern and are auto-applied at ≥0.8', async () => {
      rulesFor([ruleMatch({ matchType: 'exact', confidence: 1 }), ruleMatch({ confidence: 0.9 })]);
      const [a, b] = await categoriseMultiple([tx('TESCO'), tx('TESCO STORES')]);
      expect(a.source).toBe('rule_exact');
      expect(b.source).toBe('rule_pattern');
      expect(a.needsReview).toBe(false);
      expect(b.needsReview).toBe(false);
      expect(findSimilarTransactions).not.toHaveBeenCalled();
    });

    it('a policy match is source "policy"', async () => {
      rulesFor([ruleMatch({ isPolicy: true, confidence: 0.95, categoryId: 'cat-income', categoryName: 'Chris Income' })]);
      const [r] = await categoriseMultiple([tx('Stripe Payments UKSHOPIFY', 22.27)]);
      expect(r.source).toBe('policy');
      expect(r.categoryName).toBe('Chris Income');
      expect(r.needsReview).toBe(false);
    });

    it('an ask policy suggests its category but always needs review', async () => {
      rulesFor([ruleMatch({ isPolicy: true, action: 'ask', confidence: 0.95, categoryId: 'cat-social', categoryName: 'Social Travel', pattern: 'gridserve' })]);
      const [r] = await categoriseMultiple([tx('GRIDSERVE UK OMM LIVER', -23.36)]);
      expect(r.source).toBe('policy_ask');
      expect(r.categoryId).toBe('cat-social');
      expect(r.needsReview).toBe(true);
      expect(r.reviewReason).toMatch(/always ask/);
      expect(categoriseBatchWithAI).not.toHaveBeenCalled();
    });

    it('a low-confidence rule is applied but flagged', async () => {
      rulesFor([ruleMatch({ confidence: 0.7 })]);
      const [r] = await categoriseMultiple([tx('TESCO')]);
      expect(r.categoryId).toBe('cat-groceries');
      expect(r.needsReview).toBe(true);
    });
  });

  describe('similar precedent', () => {
    it('a strong majority is trusted without AI', async () => {
      rulesFor([null]);
      vi.mocked(findSimilarTransactions).mockResolvedValue([similar('g', 0.8), similar('g', 0.75), similar('g', 0.7)]);
      const [r] = await categoriseMultiple([tx('TESCO STORES 3021')]);
      expect(r.source).toBe('similar');
      expect(r.needsReview).toBe(false);
      expect(categoriseBatchWithAI).not.toHaveBeenCalled();
    });

    it('a weak match goes to AI and is kept as fallback if AI fails', async () => {
      rulesFor([null]);
      vi.mocked(findSimilarTransactions).mockResolvedValue([similar('g', 0.5)]);
      vi.mocked(categoriseBatchWithAI).mockRejectedValue(new Error('boom'));
      const [r] = await categoriseMultiple([tx('TESCO EXPRESS')]);
      expect(categoriseBatchWithAI).toHaveBeenCalled();
      expect(r.source).toBe('similar');
      expect(r.needsReview).toBe(true);
    });
  });

  describe('AI fallback (A6)', () => {
    it('passes precedents/corrections/policies context to the AI', async () => {
      rulesFor([null]);
      const ms = [similar('g', 0.55, 'BENA LTD TONBRIDGE')];
      vi.mocked(findSimilarTransactions).mockResolvedValue(ms);
      vi.mocked(categoriseBatchWithAI).mockResolvedValue(
        new Map([[0, { categoryId: 'takeaway', categoryName: 'Takeaway', confidence: 0.9, reasoning: 'precedent' }]])
      );
      await categoriseMultiple([tx('BENA LTD Tonbridge')]);
      expect(buildAIContext).toHaveBeenCalledWith([{ description: 'BENA LTD Tonbridge', similar: ms }]);
      expect(vi.mocked(categoriseBatchWithAI).mock.calls[0][1]).toEqual({ precedents: [[]], corrections: [], policies: [] });
    });

    it('a confident AI guess WITH settled precedent is auto-applied', async () => {
      rulesFor([null]);
      vi.mocked(findSimilarTransactions).mockResolvedValue([similar('takeaway', 0.55)]);
      vi.mocked(categoriseBatchWithAI).mockResolvedValue(
        new Map([[0, { categoryId: 'takeaway', categoryName: 'Takeaway', confidence: 0.9, reasoning: 'r' }]])
      );
      const [r] = await categoriseMultiple([tx('BENA LTD Tonbridge')]);
      expect(r.source).toBe('ai');
      expect(r.needsReview).toBe(false);
    });

    it('a confident AI guess for a NEW merchant (no precedent ≥0.5) is always reviewed', async () => {
      rulesFor([null]);
      vi.mocked(findSimilarTransactions).mockResolvedValue([similar('x', 0.35)]);
      vi.mocked(categoriseBatchWithAI).mockResolvedValue(
        new Map([[0, { categoryId: 'subs', categoryName: 'Subscriptions', confidence: 0.97, reasoning: 'r' }]])
      );
      const [r] = await categoriseMultiple([tx('BRAND NEW SAAS INC')]);
      expect(r.categoryId).toBe('subs');
      expect(r.needsReview).toBe(true);
      expect(r.reviewReason).toMatch(/new merchant/);
    });

    it('an AI result with no valid category falls back (never an invalid id) (A12)', async () => {
      rulesFor([null]);
      vi.mocked(categoriseBatchWithAI).mockResolvedValue(
        new Map([[0, { categoryId: null, categoryName: 'Made Up', confidence: 0, reasoning: 'r' }]])
      );
      const [r] = await categoriseMultiple([tx('MYSTERY')]);
      expect(r.categoryId).toBeNull();
      expect(r.source).toBe('none');
      expect(r.needsReview).toBe(true);
    });

    it('only the remaining daily quota goes to AI; the rest fall back (A11)', async () => {
      rulesFor([null, null, null]);
      vi.mocked(checkAIAvailability).mockResolvedValue({ available: true, remaining: 2, dailyLimit: 100 });
      vi.mocked(categoriseBatchWithAI).mockResolvedValue(
        new Map([
          [0, { categoryId: 'a', categoryName: 'A', confidence: 0.6, reasoning: 'r' }],
          [1, { categoryId: 'b', categoryName: 'B', confidence: 0.6, reasoning: 'r' }],
        ])
      );
      const results = await categoriseMultiple([tx('ONE'), tx('TWO'), tx('THREE')]);
      expect(vi.mocked(categoriseBatchWithAI).mock.calls[0][0]).toHaveLength(2);
      expect(trackAIUsage).toHaveBeenCalledWith(2);
      expect(results[0].source).toBe('ai');
      expect(results[2].source).toBe('none');
      expect(results[2].matchDetails).toMatch(/cap/);
    });

    it('allowAI=false never calls AI', async () => {
      rulesFor([null]);
      const [r] = await categoriseMultiple([tx('ONE')], { allowAI: false });
      expect(checkAIAvailability).not.toHaveBeenCalled();
      expect(categoriseBatchWithAI).not.toHaveBeenCalled();
      expect(r.source).toBe('none');
    });

    it('returns none when AI is unavailable', async () => {
      rulesFor([null]);
      vi.mocked(checkAIAvailability).mockResolvedValue({ available: false, remaining: 0, dailyLimit: 100 });
      const [r] = await categoriseMultiple([tx('ONE')]);
      expect(r.source).toBe('none');
      expect(categoriseBatchWithAI).not.toHaveBeenCalled();
    });
  });

  it('categoriseTransaction delegates to the batch path', async () => {
    rulesFor([ruleMatch({})]);
    const r = await categoriseTransaction(tx('TESCO'));
    expect(r.source).toBe('rule_pattern');
  });

  it('returns empty array for empty input', async () => {
    expect(await categoriseMultiple([])).toEqual([]);
  });

  describe('toTransactionCategoryFields', () => {
    it('maps engine sources to the DB enum and carries the review flag', () => {
      const base: CategorisationResult = { categoryId: 'c', categoryName: 'C', source: 'policy_ask', confidence: 0.5, matchDetails: '', needsReview: true };
      expect(toTransactionCategoryFields(base)).toEqual({
        category_id: 'c',
        categorisation_source: 'rule',
        engine_source: 'policy_ask',
        categorisation_confidence: 0.5,
        needs_review: true,
      });
      expect(toTransactionCategoryFields({ ...base, source: 'ai', needsReview: false }).categorisation_source).toBe('ai');
      expect(toTransactionCategoryFields({ ...base, source: 'none', categoryId: null }).categorisation_confidence).toBeNull();
    });
  });

  describe('calculateStats', () => {
    it('counts by source including policies', () => {
      const results: CategorisationResult[] = [
        { categoryId: 'a', categoryName: 'A', source: 'policy', confidence: 0.95, matchDetails: '' },
        { categoryId: 'a', categoryName: 'A', source: 'policy_ask', confidence: 0.5, matchDetails: '' },
        { categoryId: 'b', categoryName: 'B', source: 'ai', confidence: 0.4, matchDetails: '' },
        { categoryId: null, categoryName: null, source: 'none', confidence: 0, matchDetails: '' },
      ];
      const s = calculateStats(results);
      expect(s.bySource.policy).toBe(1);
      expect(s.bySource.policy_ask).toBe(1);
      expect(s.categorised).toBe(3);
      expect(s.uncategorised).toBe(1);
      expect(s.highConfidence).toBe(1);
      expect(s.lowConfidence).toBe(1);
      expect(s.aiUsed).toBe(1);
    });
  });
});
