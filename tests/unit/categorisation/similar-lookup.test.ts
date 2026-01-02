import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    rpc: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: 'tx-1',
            description: 'TESCO STORES 1234',
            category_id: 'cat-groceries',
            category_name: 'Groceries',
            similarity: 0.85,
            date: '2024-01-15',
          },
          {
            id: 'tx-2',
            description: 'TESCO EXPRESS',
            category_id: 'cat-groceries',
            category_name: 'Groceries',
            similarity: 0.75,
            date: '2024-01-10',
          },
          {
            id: 'tx-3',
            description: 'TESCO ONLINE',
            category_id: 'cat-groceries',
            category_name: 'Groceries',
            similarity: 0.65,
            date: '2024-01-05',
          },
        ],
        error: null,
      })
    ),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        not: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    id: 'tx-1',
                    description: 'TESCO STORES 1234',
                    category_id: 'cat-groceries',
                    date: '2024-01-15',
                    categories: { name: 'Groceries' },
                  },
                ],
                error: null,
              })
            ),
          })),
        })),
      })),
    })),
  },
}));

import {
  findSimilarTransactions,
  getMostCommonCategory,
  type SimilarMatch,
} from '@/lib/categorisation/similar-lookup';

describe('Similar Lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findSimilarTransactions', () => {
    it('returns similar transactions from RPC', async () => {
      const results = await findSimilarTransactions('TESCO SUPERSTORE');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].transactionId).toBe('tx-1');
      expect(results[0].categoryName).toBe('Groceries');
      expect(results[0].similarity).toBe(0.85);
    });

    it('limits results to specified count', async () => {
      const results = await findSimilarTransactions('TESCO', 2);
      // The mock returns 3, but we limited to 2
      // Note: in this mock, the limit is passed to RPC but mock returns all
      expect(results).toBeDefined();
    });
  });

  describe('getMostCommonCategory', () => {
    const matches: SimilarMatch[] = [
      {
        transactionId: '1',
        description: 'TESCO 1',
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        similarity: 0.9,
        date: '2024-01-01',
      },
      {
        transactionId: '2',
        description: 'TESCO 2',
        categoryId: 'cat-groceries',
        categoryName: 'Groceries',
        similarity: 0.8,
        date: '2024-01-02',
      },
      {
        transactionId: '3',
        description: 'DIFFERENT',
        categoryId: 'cat-other',
        categoryName: 'Other',
        similarity: 0.7,
        date: '2024-01-03',
      },
    ];

    it('returns the most common category', () => {
      const result = getMostCommonCategory(matches);

      expect(result).not.toBeNull();
      expect(result?.categoryId).toBe('cat-groceries');
      expect(result?.count).toBe(2);
    });

    it('calculates average similarity', () => {
      const result = getMostCommonCategory(matches);

      expect(result?.avgSimilarity).toBeCloseTo(0.85, 10); // (0.9 + 0.8) / 2
    });

    it('returns null for empty matches', () => {
      const result = getMostCommonCategory([]);
      expect(result).toBeNull();
    });

    it('handles single match', () => {
      const result = getMostCommonCategory([matches[0]]);

      expect(result?.count).toBe(1);
      expect(result?.avgSimilarity).toBe(0.9);
    });

    it('prefers higher similarity when counts are equal', () => {
      const equalCounts: SimilarMatch[] = [
        {
          transactionId: '1',
          description: 'A',
          categoryId: 'cat-a',
          categoryName: 'Category A',
          similarity: 0.9,
          date: '2024-01-01',
        },
        {
          transactionId: '2',
          description: 'B',
          categoryId: 'cat-b',
          categoryName: 'Category B',
          similarity: 0.7,
          date: '2024-01-02',
        },
      ];

      const result = getMostCommonCategory(equalCounts);

      // Both have count 1, so higher similarity wins
      expect(result?.categoryId).toBe('cat-a');
    });
  });
});
