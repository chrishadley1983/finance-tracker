import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));

import {
  selectRule,
  conditionsMatch,
  isPolicyRule,
  isoWeekday,
  ruleApplies,
  type RuleRecord,
} from '@/lib/categorisation/rule-matcher';
import { POLICIES, POLICY_CONFIDENCE, RETIRED_POLICY_KEYS } from '@/lib/categorisation/policies';
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

  it('hand-made patterns containing digits still match (the normaliser drops digit tokens)', () => {
    const rules = [rule({ pattern: 'micro1', category_id: 'chris-income' })];
    expect(selectRule(rules, { description: 'Deel Inc. Micro1 Inc', amount: 900 })?.categoryId).toBe('chris-income');
    expect(selectRule(rules, { description: 'MICRO10 LTD', amount: 900 })).toBeNull(); // still token-bounded
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

  const WEEKDAY = '2026-09-29'; // Tuesday
  const decide = (description: string, amount: number, accountId: string = JOINT, date: string = WEEKDAY) =>
    selectRule(rules, { description, amount, accountId, date });


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

  // Chris, 2026-10-01: under £20 → Social; Sat/Sun → Social; weekday £20+ → Work.
  const SAT = '2026-10-03';
  const SUN = '2026-10-04';
  const FRI = '2026-10-02';
  it.each([
    ['weekday £19.20 (was Work under the old policy)', -19.2, WEEKDAY, 'Social Travel'],
    ['weekday £19.99', -19.99, WEEKDAY, 'Social Travel'],
    ['weekday £20.00 (boundary)', -20, WEEKDAY, 'Work Travel'],
    ['weekday £22.90', -22.9, WEEKDAY, 'Work Travel'],
    ['Friday £40.70', -40.7, FRI, 'Work Travel'],
    ['Saturday £40.70', -40.7, SAT, 'Social Travel'],
    ['Sunday £37.60', -37.6, SUN, 'Social Travel'],
    ['Sunday £19.20', -19.2, SUN, 'Social Travel'],
    ['a refund (credit)', 40.7, WEEKDAY, 'Social Travel'],
  ])('SE Tonbridge: %s → %s', (_label, amount, date, expected) => {
    expect(decide('SE TONBRIDGE SST TONBRIDGE-TN9 )))', amount as number, JOINT, date as string)?.categoryName).toBe(expected);
  });

  it('SE Tonbridge outcome does not depend on rule order', () => {
    const cases: [number, string][] = [[-19.2, WEEKDAY], [-40.7, WEEKDAY], [-40.7, SAT], [-19.2, SUN], [-25, FRI]];
    const reversed = [...rules].reverse();
    for (const [amount, date] of cases) {
      const ctx = { description: 'SE TONBRIDGE SST TONBRIDGE-TN9', amount, accountId: JOINT, date };
      expect(selectRule(reversed, ctx)?.categoryName).toBe(selectRule(rules, ctx)?.categoryName);
    }
  });

  it('a weekday £20+ fare matches ONLY the Work row; a weekend £20+ fare never matches it', () => {
    const work = policyRules.find((r) => r.id === 'policy:se-tonbridge-weekday-20-plus')!;
    expect(conditionsMatch(work, { description: 'x', amount: -40.7, date: WEEKDAY })).toBe(true);
    expect(conditionsMatch(work, { description: 'x', amount: -40.7, date: SAT })).toBe(false);
    expect(conditionsMatch(work, { description: 'x', amount: -19.2, date: WEEKDAY })).toBe(false);
  });

  it('the retired £19.20/£40.70 policies are gone from POLICIES and listed as retired', () => {
    expect(POLICIES.map((p) => p.key)).not.toContain('se-tonbridge-commute-1920');
    expect(RETIRED_POLICY_KEYS).toEqual(expect.arrayContaining(['se-tonbridge-commute-1920', 'se-tonbridge-commute-4070']));
  });
});

describe('day-of-week condition', () => {
  it('isoWeekday maps dates to ISO weekdays (1=Mon … 7=Sun)', () => {
    expect(isoWeekday('2026-09-28')).toBe(1); // Monday
    expect(isoWeekday('2026-10-01')).toBe(4); // Thursday
    expect(isoWeekday('2026-10-03')).toBe(6); // Saturday
    expect(isoWeekday('2026-10-04')).toBe(7); // Sunday
    expect(isoWeekday('2026-10-04T23:30:00Z')).toBe(7);
    expect(isoWeekday(null)).toBeNull();
    expect(isoWeekday('not a date')).toBeNull();
  });

  it('matches only the listed weekdays; unknown date never matches', () => {
    const weekend = rule({ pattern: 'p', category_id: 'c', days_of_week: [6, 7] });
    expect(conditionsMatch(weekend, { description: 'p', date: '2026-10-03' })).toBe(true);
    expect(conditionsMatch(weekend, { description: 'p', date: '2026-10-04' })).toBe(true);
    expect(conditionsMatch(weekend, { description: 'p', date: '2026-10-02' })).toBe(false);
    expect(conditionsMatch(weekend, { description: 'p' })).toBe(false);
  });

  it('counts as a condition (makes the rule a policy, adds specificity)', () => {
    const r = rule({ pattern: 'p', category_id: 'c', days_of_week: [1] });
    expect(isPolicyRule(r)).toBe(true);
    const rules = [
      rule({ pattern: 'cafe', category_id: 'any', amount_sign: 'debit' }),
      rule({ pattern: 'cafe', category_id: 'weekend', amount_sign: 'debit', days_of_week: [6, 7] }),
    ];
    expect(selectRule(rules, { description: 'CAFE', amount: -3, date: '2026-10-03' })?.categoryId).toBe('weekend');
    expect(selectRule(rules, { description: 'CAFE', amount: -3, date: '2026-10-01' })?.categoryId).toBe('any');
  });
});
