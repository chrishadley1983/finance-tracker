import { describe, it, expect } from 'vitest';
import {
  annualCost,
  assessSubscription,
  cleanPattern,
  findUntracked,
  likeLiteral,
  monthlyCost,
  normaliseDescription,
  summarise,
  ukToday,
  type Charge,
  type SubscriptionRow,
} from '@/lib/subscriptions/analysis';

const TODAY = '2026-10-06';

function sub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub-1',
    name: 'Netflix',
    provider: null,
    scope: 'personal',
    category: 'Streaming',
    amount: 10.99,
    currency: 'GBP',
    frequency: 'monthly',
    next_renewal_date: null,
    cancellation_notice_days: null,
    bank_description_pattern: 'NETFLIX.COM',
    status: 'active',
    payment_method: null,
    plan_tier: null,
    notes: null,
    url: null,
    auto_renew: true,
    billing_day: null,
    start_date: null,
    end_date: null,
    ...overrides,
  };
}

const charge = (date: string, amount: number, description = 'NETFLIX.COM 866-579'): Charge => ({ date, amount, description });

describe('costs', () => {
  it('converts every frequency to monthly and annual', () => {
    expect(annualCost(10, 'weekly')).toBe(520);
    expect(annualCost(10, 'fortnightly')).toBe(260);
    expect(annualCost(10, 'monthly')).toBe(120);
    expect(annualCost(10, 'quarterly')).toBe(40);
    expect(annualCost(10, 'termly')).toBe(30);
    expect(annualCost(120, 'annual')).toBe(120);
    expect(monthlyCost(120, 'annual')).toBe(10);
  });

  it('treats an unknown frequency as monthly and ignores sign', () => {
    expect(annualCost(-10, 'yearly-ish')).toBe(120);
  });
});

describe('patterns', () => {
  it('strips wildcards and refuses empty patterns', () => {
    expect(cleanPattern(' NETFLIX* ')).toBe('NETFLIX');
    expect(cleanPattern('**')).toBeNull();
    expect(cleanPattern(null)).toBeNull();
  });

  it('escapes LIKE wildcards so they match literally', () => {
    expect(likeLiteral('50%_off\\x')).toBe('50\\%\\_off\\\\x');
  });

  it('groups descriptions by dropping trailing references', () => {
    expect(normaliseDescription('SPOTIFY   P2B3 12/09 ')).toBe('spotify p2b3');
    expect(normaliseDescription('Gym Group 0423-1199 ref')).toBe('gym group');
  });
});

describe('assessSubscription', () => {
  it('reports the last charge and a projected next due date when all is well', () => {
    const r = assessSubscription(sub(), [charge('2026-09-20', -10.99), charge('2026-08-20', -10.99)], TODAY);
    expect(r.signals).toEqual([]);
    expect(r.last_charged).toBe('2026-09-20');
    expect(r.last_amount).toBe(10.99);
    expect(r.charges_found).toBe(2);
    expect(r.next_due).toBe('2026-10-20');
    expect(r.next_due_source).toBe('projected');
    expect(r.monthly_cost).toBe(10.99);
    expect(r.annual_cost).toBe(131.88);
  });

  it('flags a price change beyond 10% but not FX noise', () => {
    expect(assessSubscription(sub(), [charge('2026-09-20', -12.99)], TODAY).signals.map((s) => s.type)).toEqual([
      'price_change',
    ]);
    expect(assessSubscription(sub(), [charge('2026-09-20', -11.5)], TODAY).signals).toEqual([]);
  });

  it('flags a missed payment once the gap passes the expected window', () => {
    const r = assessSubscription(sub(), [charge('2026-08-01', -10.99)], TODAY);
    expect(r.signals.map((s) => s.type)).toEqual(['missed_payment']);
    expect(r.signals[0].message).toContain('66 days');
  });

  it('does not flag an annual subscription charged 11 months ago', () => {
    const r = assessSubscription(sub({ frequency: 'annual', amount: 95 }), [charge('2025-11-10', -95)], TODAY);
    expect(r.signals).toEqual([]);
    expect(r.next_due).toBe('2026-11-10');
  });

  it('flags a cancelled subscription that is still being charged', () => {
    const r = assessSubscription(sub({ status: 'cancelled' }), [charge('2026-09-28', -10.99)], TODAY);
    expect(r.signals.map((s) => s.type)).toEqual(['still_charging']);
    expect(r.next_due).toBeNull();
  });

  it('stays quiet for a cancelled subscription whose last charge is old', () => {
    expect(assessSubscription(sub({ status: 'cancelled' }), [charge('2026-06-01', -10.99)], TODAY).signals).toEqual([]);
  });

  it('says when there is no bank pattern or no matching charge', () => {
    expect(assessSubscription(sub({ bank_description_pattern: null }), [], TODAY).signals[0].type).toBe('no_bank_pattern');
    expect(assessSubscription(sub(), [], TODAY).signals[0].type).toBe('no_charges_found');
  });

  it('flags a cancellation deadline within 14 days and prefers a set renewal date', () => {
    const r = assessSubscription(
      sub({ next_renewal_date: '2026-10-30', cancellation_notice_days: 14 }),
      [charge('2026-09-30', -10.99)],
      TODAY,
    );
    expect(r.signals.map((s) => s.type)).toEqual(['cancel_window']);
    expect(r.signals[0].message).toContain('2026-10-16');
    expect(r.next_due).toBe('2026-10-30');
    expect(r.next_due_source).toBe('renewal_date');
  });

  it('rolls a projected date forward past today', () => {
    const r = assessSubscription(sub({ frequency: 'weekly', amount: 5 }), [charge('2026-09-28', -5)], TODAY);
    expect(r.next_due! >= TODAY).toBe(true);
  });
});

describe('summarise', () => {
  it('totals active subscriptions by scope and category, and counts problems', () => {
    const a = assessSubscription(sub({ id: 'a' }), [charge('2026-09-20', -10.99)], TODAY);
    const b = assessSubscription(
      sub({ id: 'b', name: 'Shopify', scope: 'business', category: 'Software', amount: 25, bank_description_pattern: 'SHOPIFY' }),
      [charge('2026-09-25', -32, 'SHOPIFY')],
      TODAY,
    );
    const c = assessSubscription(sub({ id: 'c', status: 'cancelled', amount: 99 }), [], TODAY);
    const s = summarise([a, b, c]);
    expect(s.active_count).toBe(2);
    expect(s.total_count).toBe(3);
    expect(s.monthly).toBe(35.99);
    expect(s.personal_monthly).toBe(10.99);
    expect(s.business_monthly).toBe(25);
    expect(s.annual).toBe(431.88);
    expect(s.by_category[0]).toEqual({ category: 'Software', count: 1, monthly: 25 });
    expect(s.needs_attention).toBe(1); // Shopify's price change
  });
});

describe('findUntracked', () => {
  const repeat = (description: string, amounts: number[], start = 4): Charge[] =>
    amounts.map((a, i) => ({ date: `2026-0${start + i}-15`, amount: -a, description }));

  it('finds a fixed repeating charge that nothing tracks', () => {
    const out = findUntracked(repeat('GYM GROUP 0423-1199', [24.99, 24.99, 24.99]), [], []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: 'gym group', occurrences: 3, average_amount: 24.99, first_seen: '2026-04-15', last_seen: '2026-06-15' });
  });

  it('skips tracked, dismissed, excluded, varying, tiny and rare charges', () => {
    const charges = [
      ...repeat('NETFLIX.COM', [10.99, 10.99, 10.99]),
      ...repeat('DISNEY PLUS', [7.99, 7.99, 7.99]),
      ...repeat('TESCO STORES', [8, 8, 8]),
      ...repeat('ODD SHOP', [5, 30, 60]),
      ...repeat('APP FEE', [0.99, 0.99, 0.99]),
      ...repeat('ONCE TWICE', [9, 9]),
    ];
    expect(findUntracked(charges, ['netflix.com'], ['disney'])).toEqual([]);
  });
});

describe('ukToday', () => {
  it('uses the UK date, not UTC', () => {
    // 23:30 UTC on 5 Oct is 00:30 BST on 6 Oct.
    expect(ukToday(new Date('2026-10-05T23:30:00Z'))).toBe('2026-10-06');
    // 23:30 UTC on 5 Jan is still 5 Jan in GMT.
    expect(ukToday(new Date('2026-01-05T23:30:00Z'))).toBe('2026-01-05');
  });
});
