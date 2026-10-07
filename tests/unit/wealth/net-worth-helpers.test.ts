import { describe, it, expect } from 'vitest';
import {
  addMonths,
  axisGBP,
  describeChange,
  filterHistory,
  groupByType,
  monthLabel,
  netWorthChanges,
  parseMonthParam,
} from '@/components/wealth/net-worth-helpers';
import { monthTotals } from '@/components/wealth/MonthlySnapshotForm';
import { buildMonthlyRows } from '@/components/wealth/SnapshotHistoryTable';

const now = new Date(2026, 9, 7); // 7 Oct 2026

describe('month params', () => {
  it('accepts YYYY-MM and falls back to this month for anything else', () => {
    expect(parseMonthParam('2026-05', now)).toBe('2026-05');
    expect(parseMonthParam('2026-13', now)).toBe('2026-10');
    expect(parseMonthParam('may', now)).toBe('2026-10');
    expect(parseMonthParam(null, now)).toBe('2026-10');
  });

  it('never goes past the current month', () => {
    expect(parseMonthParam('2027-01', now)).toBe('2026-10');
  });

  it('adds months across year ends and labels them', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(monthLabel('2026-09')).toBe('September 2026');
  });
});

const point = (date: string, total: number) => ({ date, total, byType: {} });

describe('filterHistory', () => {
  const pts = [point('2021-10-01', 1), point('2024-10-01', 2), point('2025-11-01', 3), point('2026-10-01', 4)];
  it('keeps points inside the period', () => {
    expect(filterHistory(pts, '1y', now).map((p) => p.total)).toEqual([3, 4]);
    expect(filterHistory(pts, '2y', now).map((p) => p.total)).toEqual([2, 3, 4]);
    expect(filterHistory(pts, 'all', now)).toHaveLength(4);
  });
});

describe('netWorthChanges', () => {
  it('measures this year from the last point before January', () => {
    const hist = [point('2025-11-01', 900), point('2025-12-01', 1000), point('2026-06-01', 1100)];
    expect(netWorthChanges(1250, 30, hist, now)).toEqual({ month: 30, year: 250 });
  });

  it('has no yearly change without last year’s data', () => {
    expect(netWorthChanges(1250, null, [point('2026-02-01', 1)], now)).toEqual({ month: null, year: null });
  });
});

describe('describeChange', () => {
  const f = (n: number) => `£${n}`;
  it('says up, down or unchanged', () => {
    expect(describeChange(120, f)).toBe('up £120');
    expect(describeChange(-40, f)).toBe('down £40');
    expect(describeChange(0.2, f)).toBe('unchanged');
  });
});

describe('groupByType', () => {
  it('ranks types by total with their share', () => {
    const groups = groupByType([
      { accountType: 'isa', balance: 100 },
      { accountType: 'pension', balance: 300 },
      { accountType: 'isa', balance: 100.5 },
    ]);
    expect(groups.map((g) => [g.type, g.total])).toEqual([
      ['pension', 300],
      ['isa', 200.5],
    ]);
    expect(groups[0].share).toBeCloseTo(300 / 500.5);
    expect(groups[1].accounts.map((a) => a.balance)).toEqual([100.5, 100]);
  });
});

describe('axisGBP', () => {
  it('keeps close ticks distinct', () => {
    expect(axisGBP(1_550_000)).toBe('£1.55m');
    expect(axisGBP(1_600_000)).toBe('£1.6m');
    expect(axisGBP(450_000)).toBe('£450k');
  });
});

describe('monthTotals', () => {
  it('totals this month and compares with the same accounts last month', () => {
    const base = { accountName: 'A', accountType: 'isa' };
    const t = monthTotals([
      { ...base, accountId: 'a', balance: 120, previousBalance: 100 },
      { ...base, accountId: 'b', balance: null, previousBalance: 50 },
      { ...base, accountId: 'c', balance: 30 },
    ]);
    expect(t).toEqual({ total: 150, previousTotal: 150, change: 0 });
  });

  it('has no change when there is no previous month', () => {
    expect(monthTotals([{ accountId: 'a', accountName: 'A', accountType: 'isa', balance: 5 }]).change).toBeNull();
  });
});

describe('buildMonthlyRows', () => {
  const accounts = [
    { id: 'a', name: 'A', type: 'isa' },
    { id: 'b', name: 'B', type: 'pension' },
  ];
  it('pivots by month, newest first, with the change on the month before', () => {
    const rows = buildMonthlyRows(
      [
        { id: '1', account_id: 'a', date: '2026-09-01', balance: 100, account: null },
        { id: '2', account_id: 'b', date: '2026-09-01', balance: 50, account: null },
        { id: '3', date: '2026-10-01', balance: 120, account: { id: 'a', name: 'A', type: 'isa' } },
      ],
      accounts
    );
    expect(rows.map((r) => [r.date, r.total, r.change])).toEqual([
      ['2026-10-01', 120, -30],
      ['2026-09-01', 150, null],
    ]);
    expect(rows[0].accounts.b).toBeNull();
  });
});
