import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import {
  findSupersessions,
  findDigitRules,
  findLowQualityMinedRules,
  rejectBroadCandidates,
  mineMerchantRules,
  type EvidenceRow,
} from '@/lib/categorisation/rule-mining';
import type { RuleRecord } from '@/lib/categorisation/rule-matcher';

function rule(id: string, pattern: string, category_id: string, extra: Partial<RuleRecord> = {}): RuleRecord & { notes: string | null } {
  return {
    id, pattern, category_id, match_type: 'contains', confidence: 0.9, is_system: false,
    account_id: null, amount_sign: null, amount_min: null, amount_max: null, action: 'categorise',
    categories: { id: category_id, name: category_id }, notes: 'mined:v1 n=3 agree=100%', ...extra,
  };
}
const ev = (description: string, category_id: string, amount = 10): EvidenceRow => ({ description, amount, account_id: 'acct', category_id });

describe('findSupersessions (A1)', () => {
  it('re-points a rule when ≥75% of manual matches agree on another category', () => {
    const rules = [rule('r1', 'stripe payments ukshopify', 'transfers')];
    const evidence = Array.from({ length: 10 }, () => ev('Stripe Payments UKSHOPIFY', 'chris-income'));
    const [s] = findSupersessions(rules, evidence);
    expect(s).toMatchObject({ ruleId: 'r1', action: 'repoint', oldCategoryId: 'transfers', newCategoryId: 'chris-income' });
    expect(s.evidence).toEqual({ total: 10, disagree: 10, topShare: 1 });
  });

  it('deletes a rule when manual matches disagree but no single category reaches 75%', () => {
    const rules = [rule('r2', 'tonbridge tonbridge', 'entertainment')];
    const evidence = [
      ev('WH Smith Tonbridge Tonbridge', 'consumerables'),
      ev('FCB Tonbridge Tonbridge', 'coffee'),
      ev('Brewers Tonbridge Tonbridge', 'home-improvement'),
      ev('SumUp *Tonbridge Tonbridge', 'entertainment'),
    ];
    const [s] = findSupersessions(rules, evidence);
    expect(s).toMatchObject({ ruleId: 'r2', action: 'delete', newCategoryId: null });
  });

  it('leaves a rule alone when it agrees with most manual matches', () => {
    const rules = [rule('r3', 'pret a manger', 'coffee')];
    const evidence = [ev('PRET A MANGER', 'coffee'), ev('PRET A MANGER', 'coffee'), ev('PRET A MANGER', 'coffee'), ev('PRET A MANGER', 'eating-out'), ev('PRET A MANGER', 'eating-out')];
    expect(findSupersessions(rules, evidence)).toEqual([]);
  });

  it('needs at least 2 disagreeing manual rows', () => {
    const rules = [rule('r4', 'wh smith heathr', 'eating-out')];
    expect(findSupersessions(rules, [ev('WH SMITH HEATHROW', 'consumerables')])).toEqual([]);
    expect(findSupersessions(rules, [ev('WH Smith Heathr', 'consumerables'), ev('WH Smith Heathr', 'consumerables')])[0]?.action).toBe('repoint');
  });

  it('never touches is_system (policy) rules', () => {
    const rules = [rule('sys', 'hsbc premier', 'transfers', { is_system: true })];
    const evidence = Array.from({ length: 5 }, () => ev('HSBC PREMIER543458 543458******8906', 'cc-payments', -100));
    expect(findSupersessions(rules, evidence)).toEqual([]);
  });

  it('respects rule conditions when collecting evidence', () => {
    const rules = [rule('r5', 'hadley bricks', 'chris-income', { amount_sign: 'credit' })];
    const evidence = [ev('Hadley Bricks', 'transfers', -50), ev('Hadley Bricks', 'transfers', -60)];
    expect(findSupersessions(rules, evidence)).toEqual([]);
  });
});

describe('findDigitRules (A7a)', () => {
  it('finds mined rules carrying order/branch digits, never system or hand-made rules', () => {
    const rules = [
      rule('d1', 'ebay o 23', 'lego-out'),
      rule('d2', 'tesco stores 3021', 'groceries'),
      rule('ok', 'aldi tonbridge', 'groceries'),
      rule('hand', 'h3g bill', 'phone', { notes: null }),
      rule('sys', 'route 66', 'x', { is_system: true }),
    ];
    expect(findDigitRules(rules).map((r) => r.id)).toEqual(['d1', 'd2']);
  });
});

describe('broad-pattern guard', () => {
  const settled = (description: string, category_id: string) => ({ description, amount: -10, account_id: 'acct', category_id });

  it('rejects a key that would capture disagreeing merchants outside its group (the live "tonbridge" bug)', () => {
    const rows = [
      settled('TONBRIDGE KEBAB HOUSE', 'takeaway'),
      settled('TONBRIDGE', 'takeaway'),
      settled('TONBRIDGE', 'takeaway'),
      settled('SPOND* TPC THURSDAY - TONBRIDGE LND', 'clubs'),
      settled('NEVLL FIX IT LTD TONBRIDGE LND', 'home'),
      settled('WAITROSE TONBRIDGE', 'groceries'),
    ];
    const { kept, rejected } = rejectBroadCandidates(
      [{ pattern: 'tonbridge', categoryId: 'takeaway', total: 3, agreement: 1 }],
      rows
    );
    expect(kept).toEqual([]);
    expect(rejected[0]).toMatchObject({ pattern: 'tonbridge', matched: 6, broadAgreement: 0.5 });
  });

  it('keeps a specific key that only matches its own merchant', () => {
    const rows = [settled('ALDI TONBRIDGE', 'groceries'), settled('ALDI TONBRIDGE )))', 'groceries'), settled('ALDI TONBRIDGE', 'groceries'), settled('WAITROSE TONBRIDGE', 'groceries')];
    const { kept } = rejectBroadCandidates([{ pattern: 'aldi tonbridge', categoryId: 'groceries', total: 3, agreement: 1 }], rows);
    expect(kept).toHaveLength(1);
  });

  it('retires mined rules settled history no longer supports (<60% of ≥4 matches), never system/hand-made rules', () => {
    const rows = [
      settled('SumUp *Tonbridge Tonbridge', 'entertainment'),
      settled('WH Smith Tonbridge Tonbridge', 'consumerables'),
      settled('FCB Tonbridge Tonbridge', 'coffee'),
      settled('Brewers Tonbridge Tonbridge', 'home'),
      settled('B&M - TONBRIDGE TONBRIDGE', 'consumerables'),
    ];
    const rules = [
      rule('mined', 'tonbridge tonbridge', 'entertainment'),
      rule('hand', 'tonbridge tonbridge', 'entertainment', { notes: null }),
      rule('sys', 'tonbridge tonbridge', 'entertainment', { is_system: true }),
    ];
    const out = findLowQualityMinedRules(rules, rows);
    expect(out.map((o) => o.rule.id)).toEqual(['mined']);
    expect(out[0]).toMatchObject({ matched: 5, agreement: 0.2 });
  });
});

describe('mineMerchantRules — end to end on a fake DB', () => {
  beforeEach(() => {
    const today = '2026-09-25';
    db.current = createFakeSupabase({
      categories: [
        { id: 'transfers', name: 'Transfers' },
        { id: 'chris-income', name: 'Chris Income' },
        { id: 'lego-out', name: 'Lego Out' },
        { id: 'groceries', name: 'Groceries' },
      ],
      category_mappings: [
        rule('stripe', 'stripe payments ukshopify', 'transfers'),
        rule('ebay', 'ebay o 23', 'lego-out'),
        rule('sys', 'hsbc premier', 'transfers', { is_system: true, notes: 'policy' }),
      ].map(({ categories: _c, ...r }) => r),
      transactions: [
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `s${i}`, description: 'Stripe Payments UKSHOPIFY', amount: 20 + i, account_id: 'acct', date: today,
          category_id: 'chris-income', categorisation_source: 'manual', needs_review: false, is_validated: false,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `a${i}`, description: 'ALDI TONBRIDGE', amount: -30, account_id: 'acct', date: today,
          category_id: 'groceries', categorisation_source: 'rule', needs_review: false, is_validated: false,
        })),
      ],
      category_corrections: [],
      category_rule_events: [],
    });
  });

  it('re-points the contradicted rule, deletes the digit rule, mines new ones, and logs every change', async () => {
    const res = await mineMerchantRules({ now: new Date('2026-10-01T12:00:00Z'), skipRecategorise: true });

    const rules = db.current!.table('category_mappings');
    const stripe = rules.find((r) => r.id === 'stripe')!;
    expect(stripe.category_id).toBe('chris-income');
    expect(String(stripe.notes)).toContain('superseded:Transfers:2026-10-01');
    expect(rules.find((r) => r.id === 'ebay')).toBeUndefined();
    expect(rules.find((r) => r.id === 'sys')!.category_id).toBe('transfers');
    expect(rules.some((r) => r.pattern === 'aldi tonbridge' && r.category_id === 'groceries')).toBe(true);

    expect(res.superseded.map((s) => s.pattern)).toEqual(['stripe payments ukshopify']);
    expect(res.digitRulesDeleted).toEqual(['ebay o 23']);

    const events = db.current!.table('category_rule_events');
    expect(events.map((e) => `${e.event}:${e.pattern}`).sort()).toEqual(
      ['created:aldi tonbridge', 'deleted:ebay o 23', 'repointed:stripe payments ukshopify'].sort()
    );
  });

  it('dry run writes nothing', async () => {
    const before = JSON.stringify(db.current!.table('category_mappings'));
    const res = await mineMerchantRules({ dryRun: true, now: new Date('2026-10-01T12:00:00Z') });
    expect(JSON.stringify(db.current!.table('category_mappings'))).toBe(before);
    expect(res.superseded).toHaveLength(1);
    expect(res.created).toBeGreaterThanOrEqual(1);
    expect(db.current!.table('category_rule_events')).toHaveLength(0);
  });
});
