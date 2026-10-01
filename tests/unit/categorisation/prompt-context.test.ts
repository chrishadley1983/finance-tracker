import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));

import {
  buildBatchCategorisePrompt,
  formatContextBlock,
  type Category,
  type PromptContext,
} from '@/lib/categorisation/prompts/categorise';
import {
  describePolicy,
  descriptionSimilarity,
  selectRelevantCorrections,
  type CorrectionExample,
} from '@/lib/categorisation/ai-context';
import type { RuleRecord } from '@/lib/categorisation/rule-matcher';

const categories: Category[] = [
  { id: 'cat-coffee', name: 'Coffee', groupName: 'Discretionary', isIncome: false },
  { id: 'cat-takeaway', name: 'Takeaway', groupName: 'Discretionary', isIncome: false },
  { id: 'cat-income', name: 'Chris Income', groupName: 'Income', isIncome: true },
];

const context: PromptContext = {
  policies: [
    '- "stripe payments" (money in, on HSBC Joint Current Account) → Chris Income',
    '- "gridserve" → always flag for Chris (suggest Social Travel)',
  ],
  corrections: [{ description: 'PRET A MANGER LONDON', fromCategory: 'Eating out', toCategory: 'Coffee' }],
  precedents: [
    [{ description: 'PRET A MANGER CANARY', categoryName: 'Coffee', similarity: 0.71, date: '2026-09-12' }],
    [],
  ],
};

describe('AI prompt with learning context (A6)', () => {
  it('builds the full batch prompt (snapshot)', () => {
    const prompt = buildBatchCategorisePrompt(
      [
        { date: '2026-09-30', description: 'PRET A MANGER BANK', amount: -4.2 },
        { date: '2026-09-30', description: 'BRAND NEW PLACE $& LTD', amount: -12 },
      ],
      categories,
      context
    );
    expect(prompt).toMatchSnapshot();
  });

  it('keeps `$&` in descriptions literal (function replacers)', () => {
    const prompt = buildBatchCategorisePrompt(
      [{ date: '2026-09-30', description: 'WEIRD $& NAME', amount: -1 }],
      categories,
      context
    );
    expect(prompt).toContain('WEIRD $& NAME');
  });

  it('marks transactions with no precedent as new merchants', () => {
    expect(formatContextBlock(context)).toContain('1. (no precedent — new merchant)');
  });

  it('omits the context block entirely when there is none', () => {
    expect(formatContextBlock(undefined)).toBe('');
    const prompt = buildBatchCategorisePrompt([{ date: '2026-09-30', description: 'X', amount: -1 }], categories);
    expect(prompt).not.toContain('{contextBlock}');
    expect(prompt).not.toContain('standing policies (always follow)');
  });
});

describe('ai-context helpers', () => {
  it('describes policies in plain English', () => {
    const base = {
      id: 'r', match_type: 'contains' as const, confidence: 0.95, is_system: true,
      account_id: null, amount_sign: null, amount_min: null, amount_max: null, action: 'categorise',
    };
    const accounts = new Map([['acct-joint', 'HSBC Joint Current Account']]);
    expect(
      describePolicy({ ...base, pattern: 'stripe payments', category_id: 'c', account_id: 'acct-joint', amount_sign: 'credit', categories: { id: 'c', name: 'Chris Income' } } as RuleRecord, accounts)
    ).toBe('- "stripe payments" (money in, on HSBC Joint Current Account) → Chris Income');
    expect(
      describePolicy({ ...base, pattern: 'se tonbridge sst', category_id: 'w', amount_sign: 'debit', amount_min: 19.2, amount_max: 19.2, categories: { id: 'w', name: 'Work Travel' } } as RuleRecord, accounts)
    ).toBe('- "se tonbridge sst" (money out, amount exactly £19.20) → Work Travel');
    expect(
      describePolicy({ ...base, pattern: 'gridserve', category_id: 's', action: 'ask', categories: { id: 's', name: 'Social Travel' } } as RuleRecord, accounts)
    ).toBe('- "gridserve" → always flag for Chris (suggest Social Travel)');
  });

  it('similarity ignores bank noise and ranks the same merchant highly', () => {
    expect(descriptionSimilarity('PRET A MANGER LONDON )))', 'PRET A MANGER LONDON')).toBe(1);
    expect(descriptionSimilarity('PRET A MANGER LONDON', 'ALDI TONBRIDGE')).toBeLessThan(0.2);
  });

  it('selects only relevant corrections, newest first, capped', () => {
    const corrections: CorrectionExample[] = [
      { description: 'PRET A MANGER LONDON', fromCategory: 'Eating out', toCategory: 'Coffee', createdAt: '2026-08-01' },
      { description: 'PRET A MANGER BANK', fromCategory: 'Eating out', toCategory: 'Coffee', createdAt: '2026-09-01' },
      { description: 'ALDI TONBRIDGE', fromCategory: 'Coffee', toCategory: 'Groceries', createdAt: '2026-09-15' },
    ];
    const picked = selectRelevantCorrections(['PRET A MANGER CANARY WHARF'], corrections, 20);
    expect(picked.map((c) => c.description)).toEqual(['PRET A MANGER BANK', 'PRET A MANGER LONDON']);
    expect(selectRelevantCorrections(['PRET A MANGER CANARY WHARF'], corrections, 1)).toHaveLength(1);
  });
});
