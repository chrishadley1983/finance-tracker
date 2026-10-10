import { describe, it, expect } from 'vitest';
import { budgetUsage, monthBounds, subscriptionsSummary } from '@/lib/nav-summary';

describe('nav summary helpers', () => {
  it('month bounds handle month lengths and leap years', () => {
    expect(monthBounds('2026-10-07')).toMatchObject({ start: '2026-10-01', end: '2026-10-31', year: 2026, month: 10 });
    expect(monthBounds('2028-02-10').end).toBe('2028-02-29');
    expect(monthBounds('2026-02-10').end).toBe('2026-02-28');
  });

  it('budget usage rounds and copes with no budget', () => {
    expect(budgetUsage(2148, 3400)).toEqual({ spent: 2148, planned: 3400, usedPct: 63 });
    expect(budgetUsage(-50, 0)).toEqual({ spent: 50, planned: 0, usedPct: null });
  });

  it('subscriptions: monthly total of active subs and the next renewal', () => {
    const r = subscriptionsSummary(
      [
        { name: 'Netflix', amount: 12.99, frequency: 'monthly', status: 'active', next_renewal_date: '2026-10-12' },
        { name: 'Domain', amount: 24, frequency: 'annual', status: 'active', next_renewal_date: '2026-10-09' },
        { name: 'Old', amount: 99, frequency: 'monthly', status: 'cancelled', next_renewal_date: '2026-10-08' },
        { name: 'Past', amount: 5, frequency: 'monthly', status: 'active', next_renewal_date: '2026-10-01' },
      ],
      '2026-10-07'
    );
    expect(r.next).toEqual({ name: 'Domain', date: '2026-10-09', amount: 24 });
    expect(r.monthly).toBeGreaterThan(17.99);
    expect(r.monthly).toBeLessThan(20.1);
  });
});
