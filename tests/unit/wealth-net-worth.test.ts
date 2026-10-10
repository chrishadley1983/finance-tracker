import { describe, it, expect } from 'vitest';
import { buildValuer, netWorthHistory, previousMonthEnd, totalAt, monthEnd } from '@/lib/wealth/net-worth';

const pensionA = { id: 'A', type: 'pension' };
const pensionB = { id: 'B', type: 'pension' };
const gia = { id: 'G', type: 'investment' };
const current = { id: 'C', type: 'current' };

describe('net worth valuation', () => {
  it('carries balances forward per account, not per type (a quarterly pension never drops out)', () => {
    const snaps = [
      { account_id: 'A', date: '2026-01-01', balance: 200 },
      { account_id: 'B', date: '2026-01-01', balance: 100 },
      { account_id: 'A', date: '2026-02-01', balance: 210 }, // B not updated in February
    ];
    const h = netWorthHistory([pensionA, pensionB], snaps, [], { currentMonth: '2026-02' });
    expect(h.map((p) => p.total)).toEqual([300, 310]); // per-type carry-forward gave [300, 210]
    expect(h[1].byType.pension).toBe(310);
  });

  it('values investment accounts from wealth_snapshots', () => {
    const h = netWorthHistory([gia], [{ account_id: 'G', date: '2026-03-01', balance: 50_000 }], [], { currentMonth: '2026-03' });
    expect(h).toEqual([{ date: '2026-03-01', total: 50_000, byType: { investment: 50_000 } }]);
  });

  it('snapshot plus transactions on or after its date, up to month-end (the live RPC rule)', () => {
    const v = buildValuer([{ account_id: 'C', date: '2026-02-10', balance: 2_000 }], [
      { account_id: 'C', date: '2026-02-10', amount: 100 }, // on the snapshot day: counted, as the live RPC does
      { account_id: 'C', date: '2026-02-20', amount: 500 },
      { account_id: 'C', date: '2026-03-05', amount: -200 },
    ]);
    expect(v.balanceAt(current, '2026-02-28')).toBe(2_600);
    expect(v.balanceAt(current, '2026-03-31')).toBe(2_400);
    expect(v.balanceAt(current, '2026-01-31')).toBeNull(); // no snapshot yet: the account did not count then
  });

  it('snapshots before the period still seed the balances shown in it', () => {
    const snaps = [
      { account_id: 'A', date: '2024-06-01', balance: 150 },
      { account_id: 'B', date: '2026-05-01', balance: 100 },
    ];
    const h = netWorthHistory([pensionA, pensionB], snaps, [], { currentMonth: '2026-06', fromMonth: '2025-06' });
    expect(h.map((p) => [p.date, p.total])).toEqual([
      ['2026-05-01', 250],
      ['2026-06-01', 250],
    ]);
  });

  it('previous month-end total is valued like today and allows zero or negative totals', () => {
    expect(previousMonthEnd('2026-03-31')).toBe('2026-02-28');
    expect(previousMonthEnd('2026-01-15')).toBe('2025-12-31');
    expect(monthEnd('2024-02')).toBe('2024-02-29');
    const v = buildValuer([{ account_id: 'C', date: '2026-01-01', balance: -300 }], []);
    expect(totalAt([current], v, '2026-02-28')).toEqual({ total: -300, byType: { current: -300 } });
    expect(totalAt([current], v, '2025-12-31')).toBeNull();
  });
});
