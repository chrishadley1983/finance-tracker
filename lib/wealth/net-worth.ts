/**
 * One way to value an account at a date, used by the Wealth page's history chart and its
 * "since last month" figure, so the two agree with each other and with the headline.
 *
 * - Every account: the latest snapshot on or before the date, carried forward per ACCOUNT (not
 *   per type — carrying a type total forward dropped accounts snapshotted less often).
 * - Transactional accounts (current, credit): that snapshot plus the account's transactions after
 *   the snapshot date, up to and including the date (matches get_account_balances_with_snapshots).
 * - An account with no snapshot on or before the date has no value yet (it didn't exist then).
 */

export const TRANSACTIONAL_TYPES = new Set(['current', 'credit']);

export interface WealthAccount {
  id: string;
  type: string;
}
export interface BalancePoint {
  account_id: string;
  date: string; // YYYY-MM-DD
  balance: number;
}
export interface TxPoint {
  account_id: string;
  date: string;
  amount: number;
}

export interface AccountValuer {
  /** Value of one account at the end of `date`, or null if it has no snapshot by then. */
  balanceAt(account: WealthAccount, date: string): number | null;
}

export function buildValuer(snapshots: BalancePoint[], transactions: TxPoint[]): AccountValuer {
  const snaps = new Map<string, { date: string; balance: number }[]>();
  for (const s of snapshots) {
    const arr = snaps.get(s.account_id) ?? [];
    arr.push({ date: s.date, balance: Number(s.balance) });
    snaps.set(s.account_id, arr);
  }
  Array.from(snaps.values()).forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
  const txs = new Map<string, { date: string; amount: number }[]>();
  for (const t of transactions) {
    const arr = txs.get(t.account_id) ?? [];
    arr.push({ date: t.date, amount: Number(t.amount) });
    txs.set(t.account_id, arr);
  }
  return {
    balanceAt(account, date) {
      const arr = snaps.get(account.id);
      if (!arr) return null;
      let base: { date: string; balance: number } | null = null;
      for (const s of arr) {
        if (s.date <= date) base = s;
        else break;
      }
      if (!base) return null;
      if (!TRANSACTIONAL_TYPES.has(account.type)) return base.balance;
      let balance = base.balance;
      for (const t of txs.get(account.id) ?? []) {
        if (t.date > base.date && t.date <= date) balance += t.amount;
      }
      return balance;
    },
  };
}

/** Last day of the month containing `monthKey` (YYYY-MM), as YYYY-MM-DD. */
export function monthEnd(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(last).padStart(2, '0')}`;
}

/** Last day of the month before the one containing `today` (YYYY-MM-DD). */
export function previousMonthEnd(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}

/** Sum of the accounts that have a value at `date`; null when none do. */
export function totalAt(accounts: WealthAccount[], valuer: AccountValuer, date: string) {
  let total = 0;
  let any = false;
  const byType: Record<string, number> = {};
  for (const a of accounts) {
    const v = valuer.balanceAt(a, date);
    if (v === null) continue;
    any = true;
    total += v;
    byType[a.type] = (byType[a.type] ?? 0) + v;
  }
  return any ? { total, byType } : null;
}

/**
 * Monthly history points: one per month that has any snapshot, plus the current month, from
 * `fromMonth` (inclusive) on. Values are month-end balances, labelled YYYY-MM-01 as before.
 * Snapshots before `fromMonth` still count as starting balances.
 */
export function netWorthHistory(
  accounts: WealthAccount[],
  snapshots: BalancePoint[],
  transactions: TxPoint[],
  opts: { currentMonth: string; fromMonth?: string | null },
) {
  const valuer = buildValuer(snapshots, transactions);
  const months = new Set<string>(snapshots.map((s) => s.date.slice(0, 7)));
  months.add(opts.currentMonth);
  return Array.from(months)
    .filter((m) => m <= opts.currentMonth && (!opts.fromMonth || m >= opts.fromMonth))
    .sort()
    .flatMap((m) => {
      const t = totalAt(accounts, valuer, monthEnd(m));
      return t ? [{ date: `${m}-01`, total: t.total, byType: t.byType }] : [];
    });
}
