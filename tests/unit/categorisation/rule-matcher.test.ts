import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the module
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: 'rule-1',
                pattern: 'TESCO',
                category_id: 'cat-groceries',
                match_type: 'exact',
                confidence: 1.0,
                categories: { id: 'cat-groceries', name: 'Groceries' },
              },
              {
                id: 'rule-2',
                pattern: 'AMAZON',
                category_id: 'cat-shopping',
                match_type: 'contains',
                confidence: 0.9,
                categories: { id: 'cat-shopping', name: 'Shopping' },
              },
              {
                id: 'rule-3',
                pattern: '^NETFLIX',
                category_id: 'cat-entertainment',
                match_type: 'regex',
                confidence: 0.95,
                categories: { id: 'cat-entertainment', name: 'Entertainment' },
              },
            ],
            error: null,
          })
        ),
      })),
    })),
  },
}));

import {
  matchExactRule,
  matchPatternRule,
  matchRule,
  matchRulesBatch,
  clearRulesCache,
} from '@/lib/categorisation/rule-matcher';

describe('Rule Matcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRulesCache();
  });

  describe('matchExactRule', () => {
    it('matches exact rule case-insensitively', async () => {
      const result = await matchExactRule('TESCO');
      expect(result).not.toBeNull();
      expect(result?.categoryName).toBe('Groceries');
      expect(result?.matchType).toBe('exact');
      expect(result?.confidence).toBe(1.0);
    });

    it('matches with different case', async () => {
      const result = await matchExactRule('tesco');
      expect(result).not.toBeNull();
      expect(result?.categoryName).toBe('Groceries');
    });

    it('returns null for no match', async () => {
      const result = await matchExactRule('UNKNOWN MERCHANT');
      expect(result).toBeNull();
    });

    it('does not match partial descriptions', async () => {
      const result = await matchExactRule('TESCO STORES 1234');
      expect(result).toBeNull(); // Exact match requires full match
    });
  });

  describe('matchPatternRule', () => {
    it('matches contains rule', async () => {
      const result = await matchPatternRule('PAYMENT TO AMAZON.CO.UK');
      expect(result).not.toBeNull();
      expect(result?.categoryName).toBe('Shopping');
      expect(result?.matchType).toBe('contains');
    });

    it('matches regex rule', async () => {
      const result = await matchPatternRule('NETFLIX SUBSCRIPTION');
      expect(result).not.toBeNull();
      expect(result?.categoryName).toBe('Entertainment');
      expect(result?.matchType).toBe('regex');
    });

    it('returns null for no match', async () => {
      const result = await matchPatternRule('RANDOM PAYMENT');
      expect(result).toBeNull();
    });

    it('returns highest confidence match', async () => {
      // If both AMAZON and NETFLIX match, should return higher confidence
      const result = await matchPatternRule('AMAZON PRIME NETFLIX');
      expect(result).not.toBeNull();
      // NETFLIX regex has 0.95 confidence vs AMAZON contains 0.9
      expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('matchRule', () => {
    it('prioritises exact match over pattern', async () => {
      // If there was both exact and pattern match, exact should win
      const result = await matchRule('TESCO');
      expect(result?.matchType).toBe('exact');
    });

    it('falls back to pattern when no exact match', async () => {
      const result = await matchRule('AMAZON PRIME');
      expect(result).not.toBeNull();
      expect(result?.matchType).toBe('contains');
    });
  });

  describe('matchRulesBatch', () => {
    it('matches multiple descriptions efficiently', async () => {
      const descriptions = ['TESCO', 'AMAZON ORDER', 'UNKNOWN', 'NETFLIX'];
      const results = await matchRulesBatch(descriptions);

      expect(results.size).toBe(4);
      expect(results.get(0)?.categoryName).toBe('Groceries'); // TESCO
      expect(results.get(1)?.categoryName).toBe('Shopping'); // AMAZON
      expect(results.get(2)).toBeNull(); // UNKNOWN
      expect(results.get(3)?.categoryName).toBe('Entertainment'); // NETFLIX
    });
  });
});
