import { formatDateGB } from '@/lib/format';
import type { AccountType, AccountWithStats } from '@/lib/types/account';

/** Display order of the type groups. */
export const TYPE_ORDER: AccountType[] = ['current', 'savings', 'credit', 'isa', 'investment', 'pension', 'property', 'other'];

export const TYPE_GROUP_LABEL: Record<AccountType, string> = {
  current: 'Current accounts',
  savings: 'Savings',
  credit: 'Credit cards',
  isa: 'ISAs',
  investment: 'Investments',
  pension: 'Pensions',
  property: 'Property',
  other: 'Other',
};

/** Lower-case phrase for the opening sentence ("£4,210 in current accounts"). */
const TYPE_PHRASE: Record<AccountType, string> = {
  current: 'current accounts',
  savings: 'savings',
  credit: 'credit cards',
  isa: 'ISAs',
  investment: 'investments',
  pension: 'pensions',
  property: 'property',
  other: 'other accounts',
};

/** Types whose balance comes from transactions (others use month-end snapshots). */
export const TRANSACTION_TYPES: AccountType[] = ['current', 'savings', 'credit'];

export interface TypeGroup {
  type: AccountType;
  label: string;
  accounts: AccountWithStats[];
  total: number;
}

/** Group accounts by type in TYPE_ORDER, keeping the incoming (sort_order) order within each. */
export function groupByType(accounts: AccountWithStats[]): TypeGroup[] {
  return TYPE_ORDER.map((type) => {
    const list = accounts.filter((a) => (TYPE_ORDER.includes(a.type) ? a.type : 'other') === type);
    return {
      type,
      label: TYPE_GROUP_LABEL[type],
      accounts: list,
      total: Math.round(list.reduce((t, a) => t + (a.currentBalance || 0), 0) * 100) / 100,
    };
  }).filter((g) => g.accounts.length > 0);
}

export interface LedePart {
  type: AccountType;
  phrase: string;
  amount: number;
}

/** Totals by type for active accounts that count toward net worth. */
export function ledeParts(accounts: AccountWithStats[]): { total: number; count: number; excluded: number; parts: LedePart[] } {
  const active = accounts.filter((a) => !a.is_archived);
  const counted = active.filter((a) => a.include_in_net_worth !== false);
  const parts = groupByType(counted)
    .filter((g) => Math.round(g.total) !== 0)
    .map((g) => ({ type: g.type, phrase: TYPE_PHRASE[g.type], amount: g.total }));
  return {
    total: Math.round(counted.reduce((t, a) => t + (a.currentBalance || 0), 0) * 100) / 100,
    count: active.length,
    excluded: active.length - counted.length,
    parts,
  };
}

/**
 * Move one account up or down within its type. Returns the new full order and
 * the sort_order updates to persist (only rows whose value changes), or null
 * when the move isn't possible (already first/last in its type).
 */
export function moveWithinType(
  accounts: AccountWithStats[],
  id: string,
  dir: -1 | 1,
  /** Rows the user can see; hidden rows (e.g. archived) are stepped over. */
  isVisible: (a: AccountWithStats) => boolean = () => true
): { order: AccountWithStats[]; updates: { id: string; sort_order: number }[] } | null {
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const type = accounts[idx].type;
  // Nearest neighbour of the same type in the move direction.
  let j = idx + dir;
  while (j >= 0 && j < accounts.length && (accounts[j].type !== type || !isVisible(accounts[j]))) j += dir;
  if (j < 0 || j >= accounts.length) return null;

  const order = [...accounts];
  [order[idx], order[j]] = [order[j], order[idx]];
  const updates: { id: string; sort_order: number }[] = [];
  const renumbered = order.map((a, i) => {
    if (a.sort_order !== i) updates.push({ id: a.id, sort_order: i });
    return a.sort_order === i ? a : { ...a, sort_order: i };
  });
  return { order: renumbered, updates };
}

/** Days between an ISO date/time and now. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** "just now", "3h ago", "yesterday", "5 days ago", or a date. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (diffMin < 2) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDateGB(iso);
}
