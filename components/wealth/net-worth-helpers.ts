/**
 * Pure helpers for the Net worth page (no React), so they can be unit tested.
 */
import type { NetWorthHistoryPoint } from '@/lib/types/fire';
import { MONTH_NAMES, MONTH_SHORT } from '@/lib/format';

export type ChartPeriod = '1y' | '2y' | '5y' | 'all';

export const CHART_PERIODS: readonly { id: ChartPeriod; label: string }[] = [
  { id: '1y', label: '1 year' },
  { id: '2y', label: '2 years' },
  { id: '5y', label: '5 years' },
  { id: 'all', label: 'All' },
];

/** YYYY-MM for a date (local calendar). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Validate a YYYY-MM string from the URL; falls back to the current month. */
export function parseMonthParam(raw: string | null | undefined, now: Date = new Date()): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    // Future months can't have month-end balances yet.
    return raw > monthKey(now) ? monthKey(now) : raw;
  }
  return monthKey(now);
}

/** Shift a YYYY-MM key by n months. */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

/** "September 2026" for a YYYY-MM key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "Sep 26" for an ISO date, for chart axes. */
export function shortMonthLabel(isoDate: string): string {
  const [y, m] = isoDate.slice(0, 7).split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** Keep only the points inside the chosen period (same cut-off as /api/wealth/history). */
export function filterHistory(points: NetWorthHistoryPoint[], period: ChartPeriod, now: Date = new Date()): NetWorthHistoryPoint[] {
  if (period === 'all') return points;
  const years = period === '1y' ? 1 : period === '2y' ? 2 : 5;
  const from = monthKey(new Date(now.getFullYear() - years, now.getMonth(), 1));
  return points.filter((p) => p.date.slice(0, 7) >= from);
}

export interface NetWorthChanges {
  /** Change since last month (from the summary API). */
  month: number | null;
  /** Change since the end of last year, if history goes back that far. */
  year: number | null;
}

/**
 * Change this year = today's total minus the last recorded total of the
 * previous calendar year. Null when there's no point before January.
 */
export function netWorthChanges(
  total: number,
  monthChange: number | null,
  history: NetWorthHistoryPoint[],
  now: Date = new Date()
): NetWorthChanges {
  const yearStart = `${now.getFullYear()}-01`;
  const before = history.filter((p) => p.date.slice(0, 7) < yearStart);
  const base = before.length > 0 ? before[before.length - 1].total : null;
  return { month: monthChange, year: base === null ? null : total - base };
}

/** "up £1,200" / "down £300" / "unchanged", whole pounds. */
export function describeChange(amount: number, format: (n: number) => string): string {
  if (Math.round(amount) === 0) return 'unchanged';
  return `${amount > 0 ? 'up' : 'down'} ${format(Math.abs(amount))}`;
}

export interface TypeGroup<A> {
  type: string;
  total: number;
  share: number;
  accounts: A[];
}

/** Group accounts by type, ranked by total (largest first), with each type's share of the total. */
export function groupByType<A extends { accountType: string; balance: number }>(accounts: A[]): TypeGroup<A>[] {
  const map = new Map<string, A[]>();
  for (const a of accounts) {
    const list = map.get(a.accountType) ?? [];
    list.push(a);
    map.set(a.accountType, list);
  }
  const groups = Array.from(map.entries()).map(([type, list]) => ({
    type,
    accounts: [...list].sort((x, y) => y.balance - x.balance),
    total: list.reduce((s, a) => s + a.balance, 0),
  }));
  const grand = groups.reduce((s, g) => s + Math.max(g.total, 0), 0);
  return groups
    .sort((a, b) => b.total - a.total)
    .map((g) => ({ ...g, share: grand > 0 ? Math.max(g.total, 0) / grand : 0 }));
}

/** Axis labels that stay distinct at close ticks: "£1.55m", "£450k", "£900". */
export function axisGBP(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}£${(a / 1_000_000).toFixed(2).replace(/0$/, '')}m`;
  if (a >= 1_000) return `${sign}£${Math.round(a / 1000)}k`;
  return `${sign}£${Math.round(a)}`;
}
