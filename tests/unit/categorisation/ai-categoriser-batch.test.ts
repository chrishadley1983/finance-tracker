import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../../helpers/fake-supabase';

const mockCreate = vi.hoisted(() => vi.fn());
vi.mock('@anthropic-ai/sdk', () => {
  class RateLimitError extends Error {}
  const Anthropic = vi.fn(() => ({ messages: { create: mockCreate } })) as unknown as { RateLimitError: typeof RateLimitError };
  Anthropic.RateLimitError = RateLimitError;
  return { default: Anthropic };
});
vi.mock('@/lib/ai-usage-audit', () => ({ logAiUsage: vi.fn(), usageFields: () => ({}) }));

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { categoriseBatchWithAI, clearCategoriesCache } from '@/lib/categorisation/ai-categoriser';

function reply(items: unknown[]) {
  mockCreate.mockResolvedValue({
    id: 'msg_1',
    model: 'claude-sonnet-5',
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: 'text', text: JSON.stringify(items) }],
  });
}

describe('categoriseBatchWithAI — category validation (A12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCategoriesCache();
    db.current = createFakeSupabase({
      categories: [
        { id: 'cat-groceries', name: 'Groceries', group_name: 'Essential', is_income: false, display_order: 1 },
        { id: 'cat-coffee', name: 'Coffee', group_name: 'Discretionary', is_income: false, display_order: 2 },
      ],
    });
  });

  it('keeps a valid category id', async () => {
    reply([{ index: 0, categoryId: 'cat-coffee', categoryName: 'Coffee', confidence: 0.9, reasoning: 'r' }]);
    const res = await categoriseBatchWithAI([{ date: '2026-09-30', description: 'PRET', amount: -3 }]);
    expect(res.get(0)).toMatchObject({ categoryId: 'cat-coffee', confidence: 0.9 });
  });

  it('repairs an unknown id by exact category name', async () => {
    reply([{ index: 0, categoryId: 'not-a-real-id', categoryName: 'groceries', confidence: 0.9, reasoning: 'r' }]);
    const res = await categoriseBatchWithAI([{ date: '2026-09-30', description: 'ALDI', amount: -30 }]);
    expect(res.get(0)?.categoryId).toBe('cat-groceries');
    expect(res.get(0)?.confidence).toBeLessThanOrEqual(0.3);
  });

  it('returns a NULL category (never the invalid id) when neither id nor name exists', async () => {
    reply([{ index: 0, categoryId: 'not-a-real-id', categoryName: 'Made Up', confidence: 0.95, reasoning: 'r' }]);
    const res = await categoriseBatchWithAI([{ date: '2026-09-30', description: 'MYSTERY', amount: -30 }]);
    expect(res.get(0)?.categoryId).toBeNull();
    expect(res.get(0)?.confidence).toBe(0);
  });

  it('ignores out-of-range indexes from the model', async () => {
    reply([{ index: 7, categoryId: 'cat-coffee', categoryName: 'Coffee', confidence: 0.9, reasoning: 'r' }]);
    const res = await categoriseBatchWithAI([{ date: '2026-09-30', description: 'PRET', amount: -3 }]);
    expect(res.size).toBe(0);
  });

  it('sends the learning context in the prompt', async () => {
    reply([{ index: 0, categoryId: 'cat-coffee', categoryName: 'Coffee', confidence: 0.9, reasoning: 'r' }]);
    await categoriseBatchWithAI([{ date: '2026-09-30', description: 'PRET', amount: -3 }], {
      precedents: [[{ description: 'PRET A MANGER LONDON', categoryName: 'Coffee', similarity: 0.8, date: '2026-09-01' }]],
      corrections: [{ description: 'PRET A MANGER', fromCategory: 'Eating out', toCategory: 'Coffee' }],
      policies: ['- "mmbill com" → Transfers'],
    });
    const prompt: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('"mmbill com" → Transfers');
    expect(prompt).toContain('"PRET A MANGER": Eating out → corrected to Coffee');
    expect(prompt).toContain('"PRET A MANGER LONDON" → Coffee');
  });
});
