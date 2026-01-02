import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'category_corrections') {
        return {
          insert: mockInsert.mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'correction-1' },
                error: null,
              }),
            }),
          }),
          select: mockSelect.mockReturnValue({
            gte: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
          update: mockUpdate.mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }),
  },
}));

import {
  recordCorrection,
  recordCorrectionsBatch,
  findPatterns,
  type CorrectionRecord,
} from '@/lib/categorisation/learning';

describe('Category Learning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordCorrection', () => {
    it('records a single correction', async () => {
      const result = await recordCorrection({
        description: 'AMAZON PRIME',
        originalCategoryId: 'cat-1',
        correctedCategoryId: 'cat-2',
        originalSource: 'similar',
      });

      expect(result).toEqual({ id: 'correction-1' });
      expect(mockInsert).toHaveBeenCalledWith({
        description: 'AMAZON PRIME',
        original_category_id: 'cat-1',
        corrected_category_id: 'cat-2',
        original_source: 'similar',
        import_session_id: null,
      });
    });

    it('handles null original category', async () => {
      await recordCorrection({
        description: 'NEW TRANSACTION',
        originalCategoryId: null,
        correctedCategoryId: 'cat-2',
        originalSource: 'none',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          original_category_id: null,
        })
      );
    });

    it('includes import session ID when provided', async () => {
      await recordCorrection({
        description: 'AMAZON PRIME',
        originalCategoryId: 'cat-1',
        correctedCategoryId: 'cat-2',
        originalSource: 'similar',
        importSessionId: 'session-123',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          import_session_id: 'session-123',
        })
      );
    });
  });

  describe('recordCorrectionsBatch', () => {
    it('records multiple corrections', async () => {
      mockInsert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'c1' }, { id: 'c2' }],
          error: null,
        }),
      });

      const result = await recordCorrectionsBatch([
        {
          description: 'AMAZON PRIME',
          originalCategoryId: 'cat-1',
          correctedCategoryId: 'cat-2',
          originalSource: 'similar',
        },
        {
          description: 'NETFLIX',
          originalCategoryId: 'cat-3',
          correctedCategoryId: 'cat-4',
          originalSource: 'ai',
        },
      ]);

      expect(result).toEqual({ recorded: 2, failed: 0 });
    });

    it('returns zeros for empty array', async () => {
      const result = await recordCorrectionsBatch([]);
      expect(result).toEqual({ recorded: 0, failed: 0 });
    });
  });

  describe('findPatterns', () => {
    const createCorrection = (
      description: string,
      categoryId: string,
      categoryName: string
    ): CorrectionRecord => ({
      id: `correction-${Math.random()}`,
      description,
      original_category_id: 'cat-wrong',
      corrected_category_id: categoryId,
      original_source: 'similar',
      import_session_id: null,
      created_rule_id: null,
      created_at: new Date().toISOString(),
      corrected_category: { id: categoryId, name: categoryName },
    });

    it('finds exact match patterns', () => {
      const corrections: CorrectionRecord[] = [
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
      ];

      const suggestions = findPatterns(corrections);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].pattern).toBe('AMAZON PRIME');
      expect(suggestions[0].matchType).toBe('exact');
      expect(suggestions[0].categoryId).toBe('cat-entertainment');
      expect(suggestions[0].correctionCount).toBe(3);
    });

    it('requires minimum 3 corrections', () => {
      const corrections: CorrectionRecord[] = [
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
      ];

      const suggestions = findPatterns(corrections);
      expect(suggestions).toHaveLength(0);
    });

    it('finds contains patterns', () => {
      const corrections: CorrectionRecord[] = [
        createCorrection('TESCO STORES 1234', 'cat-groceries', 'Groceries'),
        createCorrection('TESCO EXPRESS 5678', 'cat-groceries', 'Groceries'),
        createCorrection('TESCO METRO 9012', 'cat-groceries', 'Groceries'),
      ];

      const suggestions = findPatterns(corrections);

      // Should find "tesco" as a common pattern
      const tescoPattern = suggestions.find((s) => s.pattern.toLowerCase() === 'tesco');
      expect(tescoPattern).toBeDefined();
      expect(tescoPattern?.matchType).toBe('contains');
    });

    it('prioritises exact matches over contains', () => {
      const corrections: CorrectionRecord[] = [
        createCorrection('NETFLIX', 'cat-entertainment', 'Entertainment'),
        createCorrection('NETFLIX', 'cat-entertainment', 'Entertainment'),
        createCorrection('NETFLIX', 'cat-entertainment', 'Entertainment'),
      ];

      const suggestions = findPatterns(corrections);

      // Should have exact match for NETFLIX
      const exactMatch = suggestions.find((s) => s.matchType === 'exact');
      expect(exactMatch).toBeDefined();
      expect(exactMatch?.pattern).toBe('NETFLIX');
    });

    it('separates patterns by category', () => {
      const corrections: CorrectionRecord[] = [
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
        createCorrection('AMAZON PRIME', 'cat-entertainment', 'Entertainment'),
        createCorrection('AMAZON ORDER', 'cat-shopping', 'Shopping'),
        createCorrection('AMAZON ORDER', 'cat-shopping', 'Shopping'),
        createCorrection('AMAZON ORDER', 'cat-shopping', 'Shopping'),
      ];

      const suggestions = findPatterns(corrections);

      // Should have separate patterns for different categories
      const entertainmentPattern = suggestions.find((s) => s.categoryId === 'cat-entertainment');
      const shoppingPattern = suggestions.find((s) => s.categoryId === 'cat-shopping');

      expect(entertainmentPattern).toBeDefined();
      expect(shoppingPattern).toBeDefined();
    });

    it('sorts by correction count descending', () => {
      const corrections: CorrectionRecord[] = [
        ...Array(3).fill(null).map(() => createCorrection('PATTERN A', 'cat-1', 'Category 1')),
        ...Array(5).fill(null).map(() => createCorrection('PATTERN B', 'cat-2', 'Category 2')),
        ...Array(4).fill(null).map(() => createCorrection('PATTERN C', 'cat-3', 'Category 3')),
      ];

      const suggestions = findPatterns(corrections);

      // Sort order should be: B (5), C (4), A (3)
      expect(suggestions[0].correctionCount).toBe(5);
      expect(suggestions[1].correctionCount).toBe(4);
      expect(suggestions[2].correctionCount).toBe(3);
    });

    it('ignores stop words in pattern detection', () => {
      const corrections: CorrectionRecord[] = [
        createCorrection('THE AMAZON PAYMENT', 'cat-shopping', 'Shopping'),
        createCorrection('THE AMAZON PAYMENT', 'cat-shopping', 'Shopping'),
        createCorrection('THE AMAZON PAYMENT', 'cat-shopping', 'Shopping'),
      ];

      const suggestions = findPatterns(corrections);

      // Should find "amazon" but not "the" or "payment"
      const thePattern = suggestions.find((s) => s.pattern.toLowerCase() === 'the');
      const paymentPattern = suggestions.find((s) => s.pattern.toLowerCase() === 'payment');

      expect(thePattern).toBeUndefined();
      expect(paymentPattern).toBeUndefined();
    });
  });
});
