import { describe, it, expect } from 'vitest';
import type { AccountWithStats } from '@/lib/types/account';
import { groupByType, ledeParts, moveWithinType, relativeTime } from '@/components/accounts/account-helpers';

const acc = (id: string, type: AccountWithStats['type'], sort: number | null, balance = 0, extra: Partial<AccountWithStats> = {}) =>
  ({ id, name: id, type, sort_order: sort, currentBalance: balance, is_archived: false, include_in_net_worth: true, ...extra }) as AccountWithStats;

describe('moveWithinType', () => {
  const list = [acc('c1', 'current', 0), acc('s1', 'savings', 1), acc('c2', 'current', 2), acc('c3', 'current', 3)];

  it('swaps with the nearest account of the same type and renumbers', () => {
    const r = moveWithinType(list, 'c2', -1)!;
    expect(r.order.map((a) => a.id)).toEqual(['c2', 's1', 'c1', 'c3']);
    expect(r.updates).toEqual([
      { id: 'c2', sort_order: 0 },
      { id: 'c1', sort_order: 2 },
    ]);
  });

  it('returns null at the ends of a type', () => {
    expect(moveWithinType(list, 'c1', -1)).toBeNull();
    expect(moveWithinType(list, 'c3', 1)).toBeNull();
    expect(moveWithinType(list, 's1', 1)).toBeNull();
  });

  it('steps over hidden (archived) rows', () => {
    const withArchived = [acc('c1', 'current', 0), acc('cx', 'current', 1, 0, { is_archived: true }), acc('c2', 'current', 2)];
    const r = moveWithinType(withArchived, 'c2', -1, (a) => !a.is_archived)!;
    expect(r.order.map((a) => a.id)).toEqual(['c2', 'cx', 'c1']);
  });

  it('renumbers null sort orders', () => {
    const r = moveWithinType([acc('a', 'current', null), acc('b', 'current', null)], 'b', -1)!;
    expect(r.updates).toEqual([
      { id: 'b', sort_order: 0 },
      { id: 'a', sort_order: 1 },
    ]);
  });
});

describe('groupByType / ledeParts', () => {
  const list = [
    acc('c1', 'current', 0, 100),
    acc('p1', 'pension', 1, 1000),
    acc('cc', 'credit', 2, -50),
    acc('h', 'property', 3, 5000, { include_in_net_worth: false }),
    acc('old', 'current', 4, 999, { is_archived: true }),
  ];

  it('groups in type order with totals', () => {
    expect(groupByType(list).map((g) => [g.type, g.total])).toEqual([
      ['current', 1099],
      ['credit', -50],
      ['pension', 1000],
      ['property', 5000],
    ]);
  });

  it('totals active accounts that count toward net worth', () => {
    const l = ledeParts(list);
    expect(l.total).toBe(1050);
    expect(l.count).toBe(4);
    expect(l.excluded).toBe(1);
    expect(l.parts.map((p) => [p.phrase, p.amount])).toEqual([
      ['current accounts', 100],
      ['credit cards', -50],
      ['pensions', 1000],
    ]);
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  it('reads naturally', () => {
    expect(relativeTime('2026-10-07T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-10-07T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('2026-10-06T10:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-10-01T12:00:00Z', now)).toBe('6 days ago');
  });
});
