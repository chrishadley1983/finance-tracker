import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: [
                {
                  id: 'cat-groceries',
                  name: 'Groceries',
                  group_name: 'Essential',
                  is_income: false,
                },
                {
                  id: 'cat-entertainment',
                  name: 'Entertainment',
                  group_name: 'Discretionary',
                  is_income: false,
                },
                {
                  id: 'cat-salary',
                  name: 'Salary',
                  group_name: 'Income',
                  is_income: true,
                },
              ],
              error: null,
            })
          ),
        })),
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { count: 10 },
                error: null,
              })
            ),
          })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

import Anthropic from '@anthropic-ai/sdk';
import {
  clearCategoriesCache,
  checkAIAvailability,
  trackAIUsage,
  AICategorisationError,
} from '@/lib/categorisation/ai-categoriser';

describe('AI Categoriser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCategoriesCache();
  });

  describe('AICategorisationError', () => {
    it('creates error with correct code', () => {
      const error = new AICategorisationError('Test error', 'API_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('API_ERROR');
      expect(error.name).toBe('AICategorisationError');
    });

    it('supports all error codes', () => {
      const codes = [
        'API_ERROR',
        'PARSE_ERROR',
        'INVALID_RESPONSE',
        'RATE_LIMITED',
        'TIMEOUT',
      ] as const;

      for (const code of codes) {
        const error = new AICategorisationError('Test', code);
        expect(error.code).toBe(code);
      }
    });
  });

  describe('checkAIAvailability', () => {
    it('returns availability status', async () => {
      const result = await checkAIAvailability();

      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('dailyLimit');
      expect(typeof result.available).toBe('boolean');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.dailyLimit).toBe('number');
    });
  });

  describe('trackAIUsage', () => {
    it('tracks usage without throwing', async () => {
      await expect(trackAIUsage(1)).resolves.not.toThrow();
    });

    it('tracks multiple usage counts', async () => {
      await expect(trackAIUsage(5)).resolves.not.toThrow();
    });
  });

  describe('clearCategoriesCache', () => {
    it('clears cache without throwing', () => {
      expect(() => clearCategoriesCache()).not.toThrow();
    });
  });
});
