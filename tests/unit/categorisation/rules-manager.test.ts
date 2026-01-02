import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock functions
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'category_mappings') {
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
        };
      }
      if (table === 'transactions') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'tx-1',
                    date: '2024-01-15',
                    description: 'TESCO STORES 1234',
                    amount: -45.50,
                    category_id: 'cat-groceries',
                    category: { id: 'cat-groceries', name: 'Groceries' },
                  },
                  {
                    id: 'tx-2',
                    date: '2024-01-16',
                    description: 'TESCO EXPRESS',
                    amount: -12.99,
                    category_id: null,
                    category: null,
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'category_corrections') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    }),
  },
}));

// Mock the rule-matcher cache clear
vi.mock('@/lib/categorisation/rule-matcher', () => ({
  clearRulesCache: vi.fn(),
}));

// Mock learning module
vi.mock('@/lib/categorisation/learning', () => ({
  markCorrectionsAsProcessed: vi.fn().mockResolvedValue(true),
}));

import {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  testRule,
  checkPatternExists,
  getRuleStats,
} from '@/lib/categorisation/rules-manager';
import { clearRulesCache } from '@/lib/categorisation/rule-matcher';

describe('Rules Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRules', () => {
    it('fetches all rules with categories', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          pattern: 'TESCO',
          category_id: 'cat-groceries',
          match_type: 'contains',
          confidence: 0.9,
          is_system: false,
          notes: null,
          created_at: '2024-01-01',
          category: { id: 'cat-groceries', name: 'Groceries', group_name: 'Essentials' },
        },
      ];

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
      });

      const rules = await getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe('TESCO');
    });

    it('filters by isSystem', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await getRules({ isSystem: true });

      expect(mockSelect).toHaveBeenCalled();
    });

    it('filters by categoryId', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      await getRules({ categoryId: 'cat-123' });

      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('getRule', () => {
    it('fetches a single rule by ID', async () => {
      const mockRule = {
        id: 'rule-1',
        pattern: 'AMAZON',
        category_id: 'cat-shopping',
        match_type: 'contains',
        confidence: 0.85,
        is_system: false,
        notes: 'Online shopping',
        created_at: '2024-01-01',
        category: { id: 'cat-shopping', name: 'Shopping', group_name: 'Spending' },
      };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockRule, error: null }),
        }),
      });

      const rule = await getRule('rule-1');

      expect(rule).not.toBeNull();
      expect(rule?.pattern).toBe('AMAZON');
    });

    it('returns null for non-existent rule', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      });

      const rule = await getRule('non-existent');

      expect(rule).toBeNull();
    });
  });

  describe('createRule', () => {
    it('creates a new rule', async () => {
      const mockCreated = {
        id: 'new-rule-1',
        pattern: 'NETFLIX',
        category_id: 'cat-entertainment',
        match_type: 'exact',
        confidence: 0.95,
        is_system: false,
        notes: null,
        created_at: '2024-01-15',
        category: { id: 'cat-entertainment', name: 'Entertainment', group_name: 'Lifestyle' },
      };

      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockCreated, error: null }),
        }),
      });

      const rule = await createRule({
        pattern: 'NETFLIX',
        categoryId: 'cat-entertainment',
        matchType: 'exact',
        confidence: 0.95,
      });

      expect(rule).not.toBeNull();
      expect(rule?.pattern).toBe('NETFLIX');
      expect(clearRulesCache).toHaveBeenCalled();
    });

    it('sets default confidence if not provided', async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'rule-1', confidence: 0.85 },
            error: null,
          }),
        }),
      });

      await createRule({
        pattern: 'TEST',
        categoryId: 'cat-1',
        matchType: 'contains',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: 0.85,
        })
      );
    });
  });

  describe('updateRule', () => {
    it('updates an existing rule', async () => {
      const mockUpdated = {
        id: 'rule-1',
        pattern: 'UPDATED PATTERN',
        category_id: 'cat-1',
        match_type: 'contains',
        confidence: 0.9,
        is_system: false,
        notes: 'Updated notes',
        created_at: '2024-01-01',
        category: { id: 'cat-1', name: 'Category', group_name: 'Group' },
      };

      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
          }),
        }),
      });

      const rule = await updateRule('rule-1', {
        pattern: 'UPDATED PATTERN',
        notes: 'Updated notes',
      });

      expect(rule?.pattern).toBe('UPDATED PATTERN');
      expect(clearRulesCache).toHaveBeenCalled();
    });

    it('returns existing rule if no updates provided', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'rule-1', pattern: 'EXISTING' },
            error: null,
          }),
        }),
      });

      const rule = await updateRule('rule-1', {});

      expect(rule?.pattern).toBe('EXISTING');
    });
  });

  describe('deleteRule', () => {
    it('deletes a user rule', async () => {
      // Mock getRule to return a non-system rule
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'rule-1', is_system: false },
            error: null,
          }),
        }),
      });

      mockDelete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await deleteRule('rule-1');

      expect(result).toBe(true);
      expect(clearRulesCache).toHaveBeenCalled();
    });

    it('prevents deletion of system rules', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'rule-1', is_system: true },
            error: null,
          }),
        }),
      });

      const result = await deleteRule('rule-1');

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('testRule', () => {
    it('tests exact match pattern', async () => {
      const result = await testRule('TESCO STORES 1234', 'exact', 'cat-groceries');

      expect(result.totalMatched).toBe(1);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('TESCO STORES 1234');
    });

    it('tests contains pattern', async () => {
      const result = await testRule('TESCO', 'contains', 'cat-groceries');

      expect(result.totalMatched).toBe(2); // Both transactions contain TESCO
    });

    it('counts transactions that would change category', async () => {
      const result = await testRule('TESCO', 'contains', 'cat-new');

      // Both transactions would change: one from groceries, one from null
      expect(result.wouldChange).toBe(2);
    });

    it('limits results', async () => {
      const result = await testRule('TESCO', 'contains', 'cat-groceries', 1);

      expect(result.transactions).toHaveLength(1);
    });
  });

  describe('checkPatternExists', () => {
    it('returns rule if pattern exists', async () => {
      const existingRule = {
        id: 'rule-1',
        pattern: 'TESCO',
        match_type: 'contains',
      };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [existingRule],
          error: null,
        }),
      });

      const result = await checkPatternExists('tesco', 'contains');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('rule-1');
    });

    it('returns null if pattern does not exist', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const result = await checkPatternExists('NEWPATTERN', 'exact');

      expect(result).toBeNull();
    });
  });

  describe('getRuleStats', () => {
    it('calculates rule statistics', async () => {
      const mockRules = [
        { id: '1', match_type: 'exact', is_system: true, created_at: new Date().toISOString() },
        { id: '2', match_type: 'contains', is_system: false, created_at: new Date().toISOString() },
        { id: '3', match_type: 'contains', is_system: false, created_at: '2023-01-01' },
        { id: '4', match_type: 'regex', is_system: true, created_at: '2023-01-01' },
      ];

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
      });

      const stats = await getRuleStats();

      expect(stats.total).toBe(4);
      expect(stats.byMatchType.exact).toBe(1);
      expect(stats.byMatchType.contains).toBe(2);
      expect(stats.byMatchType.regex).toBe(1);
      expect(stats.systemRules).toBe(2);
      expect(stats.userRules).toBe(2);
      expect(stats.recentlyCreated).toBe(2); // Rules created in last 30 days
    });
  });
});
