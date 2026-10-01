import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));

import {
  selectRule,
  conditionsMatch,
  isPolicyRule,
  ruleApplies,
  type RuleRecord,
} from '@/lib/categorisation/rule-matcher';
import { POLICIES, POLICY_CONFIDENCE } from '@/lib/categorisation/policies';
import { policyRow } from '@/lib/categorisation/policy-sync';

const JOINT = 'acct-joint';
const CARD = 'acct-card';

function rule(partial: Partial<RuleRecord> & { pattern: string; category_id: string }): RuleRecord {
  return {
    id: `rule-${partial.pattern}-${partial.category_id}-${partial.amount_min ?? ''}-${partial.account_id ?? ''}`,
    match_type: 'contains',
    confidence: 0.9,
    is_system: false,
    account_id: null,
    amount_sign: null,
    amount_min: null,
    amount_max: null,
    action: 'categorise',
    categories: { id: partial.category_id, name: partial.category_id },
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// A3: conditions + ask + precedence
// ---------------------------------------------------------------------------

describe('policy rule conditions (A3)', () => {
  it('account condition only matches that account', () => {
    const r = rule({ pattern: 'stripe payments', category_id: 'income', account_id: JOINT, is_system: true });
    expect(conditionsMatch(r, { description: 'x', amount: 10, accountId: JOINT })).toBe(true);
    expect(conditionsMatch(r, { description: 'x', amount: 10, accountId: CARD })).toBe(false);
    expect(conditionsMatch(r, { description: 'x', amount: 10 })).toBe(false); // unknown account never matches
  });

  it('sign condition: credit = money in, debit = money out', () => {
    const credit = rule({ pattern: 'p', category_id: 'c', amount_sign: 'credit' });
    const debit = rule({ pattern: 'p', category_id: 'c', amount_sign: 'debit' });
    expect(conditionsMatch(credit, { description: 'p', amount: 5 })).toBe(true);
    expect(conditionsMatch(credit, { description: 'p', amount: -5 })).toBe(false);
    expect(conditionsMatch(debit, { description: 'p', amount: -5 })).toBe(true);
    expect(conditionsMatch(debit, { description: 'p', amount: 5 })).toBe(false);
    expect(conditionsMatch(debit, { description: 'p' })).toBe(false); // unknown amount never matches
  });

  it('amount min/max compare |amount|, inclusive', () => {
    const r = rule({ pattern: 'p', category_id: 'c', amount_min: 19.2, amount_max: 19.2 });
    expect(conditionsMatch(r, { description: 'p', amount: -19.2 })).toBe(true);
    expect(conditionsMatch(r, { description: 'p', amount: -19.21 })).toBe(false);
    const range = rule({ pattern: 'p', category_id: 'c', amount_min: '10', amount_max: '20' });
    expect(conditionsMatch(range, { description: 'p', amount: 10 })).toBe(true);
    expect(conditionsMatch(range, { description: 'p', amount: 20 })).toBe(true);
    expect(conditionsMatch(range, { description: 'p', amount: 20.5 })).toBe(false);
  });

  it('a rule with any condition or the ask action is a policy', () => {
    expect(isPolicyRule(rule({ pattern: 'p', category_id: 'c' }))).toBe(false);
    expect(isPolicyRule(rule({ pattern: 'p', category_id: 'c', is_system: true }))).toBe(true);
    expect(isPolicyRule(rule({ pattern: 'p', category_id: 'c', amount_sign: 'debit' }))).toBe(true);
    expect(isPolicyRule(rule({ pattern: 'p', category_id: 'c', action: 'ask' }))).toBe(true);
  });

  it('ask action returns the suggestion with action=ask', () => {
    const m = selectRule([rule({ pattern: 'gridserve', category_id: 'social', action: 'ask' })], {
      description: 'GRIDSERVE UK OMM LIVER',
      amount: -23.36,
    });
    expect(m?.action).toBe('ask');
    expect(m?.categoryId).toBe('social');
    expect(m?.isPolicy).toBe(true);
  });

  it('policies beat exact and higher-confidence contains rules', () => {
    const rules = [
      rule({ pattern: 'stripe payments ukshopify', category_id: 'transfers', confidence: 1 }),
      rule({ pattern: 'Stripe Payments UKSHOPIFY', category_id: 'exact-transfers', match_type: 'exact', confidence: 1 }),
      rule({ pattern: 'stripe payments', category_id: 'income', account_id: JOINT, amount_sign: 'credit', is_system: true, confidence: 0.95 }),
    ];
    const m = selectRule(rules, { description: 'Stripe Payments UKSHOPIFY', amount: 22.27, accountId: JOINT });
    expect(m?.categoryId).toBe('income');
    // Conditions not met → falls through to exact, then contains.
    expect(selectRule(rules, { description: 'Stripe Payments UKSHOPIFY', amount: -5, accountId: JOINT })?.categoryId).toBe('exact-transfers');
  });

  it('the most specific matching policy wins', () => {
    const rules = [
      rule({ pattern: 'se tonbridge sst', category_id: 'social', is_system: true }),
      rule({ pattern: 'se tonbridge sst', category_id: 'work', is_system: true, amount_sign: 'debit', amount_min: 19.2, amount_max: 19.2 }),
    ];
    expect(selectRule(rules, { description: 'SE TONBRIDGE SST TONBRIDGE-TN9 )))', amount: -19.2 })?.categoryId).toBe('work');
    expect(selectRule(rules, { description: 'SE TONBRIDGE SST TONBRIDGE-TN9 )))', amount: -22.9 })?.categoryId).toBe('social');
  });
});

// ---------------------------------------------------------------------------
// A7(b): token-bounded contains only
// ---------------------------------------------------------------------------

describe('contains rules are token-bounded on the normalised description (A7b)', () => {
  it('does not match inside another word', () => {
    const rules = [rule({ pattern: 'aldi', category_id: 'groceries' }), rule({ pattern: 'Energy', category_id: 'utilities' })];
    expect(selectRule(rules, { description: 'VIVALDI RESTAURANT' })).toBeNull();
    expect(selectRule(rules, { description: 'MONSTERENERGYDRINK LTD' })).toBeNull();
    expect(selectRule(rules, { description: 'ALDI TONBRIDGE' })?.categoryId).toBe('groceries');
    expect(selectRule(rules, { description: 'OCTOPUS ENERGY DD' })?.categoryId).toBe('utilities');
  });

  it('ruleApplies honours pattern and conditions together', () => {
    const r = rule({ pattern: 'hadley bricks', category_id: 'income', amount_sign: 'credit' });
    expect(ruleApplies(r, { description: 'Hadley Bricks CR', amount: 500 })).toBe(true);
    expect(ruleApplies(r, { description: 'Hadley Bricks', amount: -20 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A4: Chris's seeded policies, against real descriptions
// ---------------------------------------------------------------------------

describe("Chris's seeded policies (A4)", () => {
  const categoryNames = Array.from(new Set(POLICIES.map((p) => p.categoryName)));
  const categoryIdByName = new Map(categoryNames.map((n) => [n, `cat:${n}`]));
  const accountIdByName = new Map([['HSBC Joint Current Account', JOINT]]);
  const policyRules: RuleRecord[] = POLICIES.map((p) => {
    const row = policyRow(p, categoryIdByName, accountIdByName);
    return { id: `policy:${p.key}`, ...row, categories: { id: row.category_id, name: p.categoryName } };
  });
  // Live rules the policies must beat (the stripe one is the one Chris corrected 10 times).
  const distractors = [
    rule({ pattern: 'stripe payments ukshopify', category_id: 'cat:Transfers' }),
    rule({ pattern: 'hadley bricks sent', category_id: 'cat:Transfers', confidence: 0.95 }),
    rule({ pattern: 'tonbridge tonbridge', category_id: 'cat:Entertainment' }),
  ];
  const rules = [...distractors, ...policyRules];

  const decide = (description: string, amount: number, accountId: string = JOINT) =>
    selectRule(rules, { description, amount, accountId });

  it('every policy is an is_system rule at the policy confidence', () => {
    for (const r of policyRules) {
      expect(r.is_system).toBe(true);
      expect(r.confidence).toBe(POLICY_CONFIDENCE);
    }
  });

  it.each([
    ['Stripe Payments UKSHOPIFY', 22.27, 'Chris Income'],
    ['SHOPIFY INC SHOPIFY /PAYER ACC', 86.95, 'Chris Income'],
    ['EBAY Commerce UK L P*7272765884 CR', 81.63, 'Chris Income'],
    ['Hadley Bricks', 500, 'Chris Income'],
    ['Hadley Bricks CR', 460, 'Chris Income'],
    ['MMBILL.COM IRVINE CA', -30, 'Transfers'],
    ['SP HORSHAM COFFEE BURGESS HILL', -41.85, 'Groceries'],
    ['SP HORSHAM COFFEE RO BURGESS HILL LND', -44.6, 'Groceries'],
    ['Non-Sterling Transaction Fee', -0.51, 'Holiday Travel'],
    ['NON-STERLING TRANSACTION FEE', -7.54, 'Holiday Travel'],
    ['SE TONBRIDGE SST TONBRIDGE-TN9 )))', -19.2, 'Work Travel'],
    ['SE TONBRIDGE SST TONBRIDGE-TN9 VIS', -19.2, 'Work Travel'],
    ['SE TONBRIDGE SST TONBRIDGE-TN9', -40.7, 'Work Travel'],
    ['SE TONBRIDGE SST TONBRIDGE-TN9 )))', -22.9, 'Social Travel'],
    ['PAYMENT - THANK YOU', 250, 'Credit card payments'],
    ['INTEREST', -12.4, 'Service fees & bank charges'],
  ])('%s (%d) → %s', (description, amount, expected) => {
    const m = decide(description, amount);
    expect(m?.categoryName).toBe(expected);
    expect(m?.action).toBe('categorise');
  });

  it('Stripe/Shopify/eBay credits only count as Chris Income on the joint account', () => {
    expect(decide('Stripe Payments UKSHOPIFY', 22.27, CARD)?.categoryName).toBe('cat:Transfers');
    expect(decide('SHOPIFY INC SHOPIFY /PAYER ACC', 86.95, CARD)).toBeNull();
  });

  it('a Hadley Bricks DEBIT is not drawings', () => {
    expect(decide('Hadley Bricks', -50)?.categoryName).not.toBe('Chris Income');
  });

  it.each([
    'GRIDSERVE UK OMM LIVER',
    'INSTAVOLT LIMITED Basingstoke',
    'TotalEnergies Charging Brussels BEL',
    "INT'L 0036124085 CIRCLE K RECHARGE HORSENS DKK 887.69 @8.7002 Visa Rate",
    "INT'L 0076278519 Mol*Robo Charge B 31610924464 EUR 18.09 @ 1.1544 Visa Rate VIS",
    'APPLEGREEN ELECTRI',
  ])('EV charging always asks: %s', (description) => {
    const m = decide(description, -25);
    expect(m?.action).toBe('ask');
    expect(m?.categoryName).toBe('Social Travel');
  });
});
