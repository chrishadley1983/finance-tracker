import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/categorisation/rule-matcher', () => ({
  matchRule: vi.fn(),
  matchRulesBatch: vi.fn(),
  clearRulesCache: vi.fn(),
}));

vi.mock('@/lib/categorisation/similar-lookup', () => ({
  findSimilarTransactions: vi.fn(),
  getMostCommonCategory: vi.fn(),
  findSimilarBatch: vi.fn(),
}));

vi.mock('@/lib/categorisation/ai-categoriser', () => ({
  categoriseWithAI: vi.fn(),
  categoriseBatchWithAI: vi.fn(),
  checkAIAvailability: vi.fn(() =>
    Promise.resolve({ available: true, remaining: 100, dailyLimit: 100 })
  ),
  trackAIUsage: vi.fn(),
  clearCategoriesCache: vi.fn(),
}));

import {
  categoriseTransaction,
  categoriseMultiple,
  calculateStats,
  type CategorisationResult,
} from '@/lib/categorisation/engine';
import { matchRule, matchRulesBatch } from '@/lib/categorisation/rule-matcher';
import {
  findSimilarTransactions,
  getMostCommonCategory,
} from '@/lib/categorisation/similar-lookup';
import {
  categoriseWithAI,
  categoriseBatchWithAI,
  checkAIAvailability,
} from '@/lib/categorisation/ai-categoriser';

describe('Categorisation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('categoriseTransaction', () => {
    it('returns exact rule match when found', async () => {
      vi.mocked(matchRule).mockResolvedValue({
        ruleId: 'rule-1',
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        pattern: 'TESCO',
        matchType: 'exact',
        confidence: 1.0,
      });

      const result = await categoriseTransaction({
        description: 'TESCO',
        amount: -50.0,
        date: '2024-01-15',
      });

      expect(result.source).toBe('rule_exact');
      expect(result.categoryId).toBe('cat-groceries');
      expect(result.confidence).toBe(1.0);
      expect(findSimilarTransactions).not.toHaveBeenCalled();
      expect(categoriseWithAI).not.toHaveBeenCalled();
    });

    it('returns pattern rule match when found', async () => {
      vi.mocked(matchRule).mockResolvedValue({
        ruleId: 'rule-2',
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        pattern: 'TESCO',
        matchType: 'contains',
        confidence: 0.9,
      });

      const result = await categoriseTransaction({
        description: 'TESCO STORES 1234',
        amount: -50.0,
        date: '2024-01-15',
      });

      expect(result.source).toBe('rule_pattern');
      expect(result.categoryId).toBe('cat-groceries');
      expect(result.confidence).toBe(0.9);
    });

    it('falls back to similar transactions when no rule matches', async () => {
      vi.mocked(matchRule).mockResolvedValue(null);
      vi.mocked(findSimilarTransactions).mockResolvedValue([
        {
          transactionId: 'tx-1',
          description: 'AMAZON UK',
          categoryId: 'cat-shopping',
          categoryName: 'Shopping',
          similarity: 0.8,
          date: '2024-01-10',
        },
        {
          transactionId: 'tx-2',
          description: 'AMAZON PRIME',
          categoryId: 'cat-shopping',
          categoryName: 'Shopping',
          similarity: 0.7,
          date: '2024-01-05',
        },
      ]);
      vi.mocked(getMostCommonCategory).mockReturnValue({
        categoryId: 'cat-shopping',
        categoryName: 'Shopping',
        count: 2,
        avgSimilarity: 0.75,
      });

      const result = await categoriseTransaction({
        description: 'AMAZON MARKETPLACE',
        amount: -25.0,
        date: '2024-01-15',
      });

      expect(result.source).toBe('similar');
      expect(result.categoryId).toBe('cat-shopping');
      expect(result.confidence).toBeGreaterThan(0);
      expect(categoriseWithAI).not.toHaveBeenCalled();
    });

    it('falls back to AI when no rule or similar matches', async () => {
      vi.mocked(matchRule).mockResolvedValue(null);
      vi.mocked(findSimilarTransactions).mockResolvedValue([]);
      vi.mocked(getMostCommonCategory).mockReturnValue(null);
      vi.mocked(categoriseWithAI).mockResolvedValue({
        categoryId: 'cat-entertainment',
        categoryName: 'Entertainment',
        confidence: 0.85,
        reasoning: 'Looks like a streaming service',
      });

      const result = await categoriseTransaction({
        description: 'NOVEL STREAMING SERVICE',
        amount: -9.99,
        date: '2024-01-15',
      });

      expect(result.source).toBe('ai');
      expect(result.categoryId).toBe('cat-entertainment');
      expect(result.confidence).toBe(0.85);
      expect(categoriseWithAI).toHaveBeenCalled();
    });

    it('returns none when AI is not available', async () => {
      vi.mocked(matchRule).mockResolvedValue(null);
      vi.mocked(findSimilarTransactions).mockResolvedValue([]);
      vi.mocked(getMostCommonCategory).mockReturnValue(null);
      vi.mocked(checkAIAvailability).mockResolvedValue({
        available: false,
        remaining: 0,
        dailyLimit: 100,
      });

      const result = await categoriseTransaction({
        description: 'UNKNOWN TRANSACTION',
        amount: -50.0,
        date: '2024-01-15',
      });

      expect(result.source).toBe('none');
      expect(result.categoryId).toBeNull();
      expect(categoriseWithAI).not.toHaveBeenCalled();
    });

    it('skips AI when confidence threshold is met by similar', async () => {
      vi.mocked(matchRule).mockResolvedValue(null);
      vi.mocked(findSimilarTransactions).mockResolvedValue([
        {
          transactionId: 'tx-1',
          description: 'NETFLIX',
          categoryId: 'cat-entertainment',
          categoryName: 'Entertainment',
          similarity: 0.95,
          date: '2024-01-10',
        },
      ]);
      vi.mocked(getMostCommonCategory).mockReturnValue({
        categoryId: 'cat-entertainment',
        categoryName: 'Entertainment',
        count: 1,
        avgSimilarity: 0.95,
      });

      const result = await categoriseTransaction({
        description: 'NETFLIX.COM',
        amount: -15.99,
        date: '2024-01-15',
      });

      expect(result.source).toBe('similar');
      expect(categoriseWithAI).not.toHaveBeenCalled();
    });
  });

  describe('categoriseMultiple', () => {
    it('categorises transactions with rule matches', async () => {
      vi.mocked(matchRulesBatch).mockResolvedValue(
        new Map([
          [
            0,
            {
              ruleId: 'rule-1',
              categoryId: 'cat-groceries',
              categoryName: 'Groceries',
              pattern: 'TESCO',
              matchType: 'exact',
              confidence: 1.0,
            },
          ],
          [
            1,
            {
              ruleId: 'rule-2',
              categoryId: 'cat-shopping',
              categoryName: 'Shopping',
              pattern: 'AMAZON',
              matchType: 'contains',
              confidence: 0.9,
            },
          ],
        ])
      );

      const results = await categoriseMultiple([
        { description: 'TESCO', amount: -50, date: '2024-01-15' },
        { description: 'AMAZON UK', amount: -25, date: '2024-01-15' },
      ]);

      expect(results.length).toBe(2);
      expect(results[0].source).toBe('rule_exact');
      expect(results[0].categoryName).toBe('Groceries');
      expect(results[1].source).toBe('rule_pattern');
      expect(results[1].categoryName).toBe('Shopping');
    });

    it('returns empty array for empty input', async () => {
      const results = await categoriseMultiple([]);
      expect(results.length).toBe(0);
    });

    it('falls back to similar when no rule matches', async () => {
      vi.mocked(matchRulesBatch).mockResolvedValue(
        new Map([[0, null]])
      );

      vi.mocked(findSimilarTransactions).mockResolvedValue([
        {
          transactionId: 'tx-1',
          description: 'SIMILAR TX',
          categoryId: 'cat-shopping',
          categoryName: 'Shopping',
          similarity: 0.8,
          date: '2024-01-01',
        },
      ]);

      vi.mocked(getMostCommonCategory).mockReturnValue({
        categoryId: 'cat-shopping',
        categoryName: 'Shopping',
        count: 1,
        avgSimilarity: 0.8,
      });

      const results = await categoriseMultiple([
        { description: 'UNKNOWN TX', amount: -50, date: '2024-01-15' },
      ]);

      expect(results.length).toBe(1);
      expect(results[0].source).toBe('similar');
    });
  });

  describe('calculateStats', () => {
    it('calculates statistics for categorisation results', () => {
      const results: CategorisationResult[] = [
        {
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          source: 'rule_exact',
          confidence: 1.0,
          matchDetails: 'Rule: TESCO',
        },
        {
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          source: 'rule_pattern',
          confidence: 0.9,
          matchDetails: 'Pattern: SAINSBURY',
        },
        {
          categoryId: 'cat-2',
          categoryName: 'Shopping',
          source: 'similar',
          confidence: 0.75,
          matchDetails: 'Similar: 3 matches',
        },
        {
          categoryId: 'cat-3',
          categoryName: 'Entertainment',
          source: 'ai',
          confidence: 0.4, // Low confidence AI result
          matchDetails: 'AI: streaming service',
        },
        {
          categoryId: null,
          categoryName: null,
          source: 'none',
          confidence: 0,
          matchDetails: 'No match found',
        },
      ];

      const stats = calculateStats(results);

      expect(stats.total).toBe(5);
      expect(stats.bySource.rule_exact).toBe(1);
      expect(stats.bySource.rule_pattern).toBe(1);
      expect(stats.bySource.similar).toBe(1);
      expect(stats.bySource.ai).toBe(1);
      expect(stats.bySource.none).toBe(1);
      expect(stats.categorised).toBe(4);
      expect(stats.uncategorised).toBe(1);
      // High confidence: 1.0, 0.9 = 2 (>= 0.8)
      expect(stats.highConfidence).toBe(2);
      // Low confidence: 0.4 (< 0.5, but has categoryId)
      expect(stats.lowConfidence).toBe(1);
    });

    it('handles empty results', () => {
      const stats = calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.categorised).toBe(0);
    });
  });
});
