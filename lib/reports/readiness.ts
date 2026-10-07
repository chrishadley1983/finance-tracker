/**
 * Month-close readiness
 *
 * Is all the data for month M in, so its monthly report can be generated (or
 * must be regenerated)? Used by GET /api/monthly-reports/readiness, which
 * Peter's 19:00 digest and the hourly month-close job (1st–7th) call to show
 * a "📅 Month close" block and to generate the report as soon as it's ready.
 *
 * Checks (archived accounts are excluded throughout):
 * - wealth:      every net-worth, snapshot-taking, non-transactional account
 *                (not current/credit) has a wealth snapshot dated exactly the
 *                1st of M+1 — the report takes the latest snapshot ≤ that date.
 * - synced:      every sync-enabled current/credit account last synced at or
 *                after 00:00 UK on the 2nd of M+1, so late-posting month-end
 *                card transactions have landed.
 * - categorised: no transaction dated in M is uncategorised or flagged.
 * - validated:   no transaction dated in M is unvalidated.
 *
 * A report that exists and is current means action 'none' even if a check is
 * failing (e.g. on the 1st, before the 2nd's sync) — the month is closed.
 *
 * Regeneration rule (explicit): an existing report is regenerated ONLY when
 * report-relevant data changed after its generated_at — a transaction dated in
 * M, or a wealth snapshot dated M-01..(M+1)-01, inserted or edited (amount,
 * date, category, account / balance) after it. `data_changed_at` (trigger,
 * 2026-10-01) records edits; older rows fall back to created_at. Validation
 * alone never triggers a regeneration.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import { MONTH_NAMES } from '../format';

export type CheckKey = 'wealth' | 'synced' | 'categorised' | 'validated';

export interface ReadinessCheck {
  key: CheckKey;
  ok: boolean;
  detail: string;
  /** wealth/synced: account names missing or behind. */
  missing?: string[];
  /** categorised/validated: how many transactions. */
  count?: number;
  /** validated: count per account name. */
  byAccount?: Record<string, number>;
}

export type ReadinessAction = 'wait' | 'generate' | 'regenerate' | 'none';

export interface MonthReadiness {
  year: number;
  month: number;
  monthLabel: string;
  ready: boolean;
  checks: ReadinessCheck[];
  reportExists: boolean;
  reportGeneratedAt: string | null;
  /** Latest report-relevant change for M (null if none recorded). */
  dataChangedAt: string | null;
  /** Report exists and some of M's data changed after it. */
  changedSinceReport: boolean;
  /** Transactions dated in M that arrived after the report was generated. */
  lateTransactions: number;
  action: ReadinessAction;
}

export interface ReadinessAccount {
  id: string;
  name: string;
  type: string;
  is_archived: boolean | null;
  include_in_net_worth: boolean | null;
  exclude_from_snapshots: boolean | null;
  sync_enabled: boolean | null;
  last_sync_at: string | null;
}

export interface ReadinessSnapshot {
  account_id: string;
  date: string;
  created_at: string | null;
  data_changed_at: string | null;
}

export interface ReadinessTransaction {
  id: string;
  account_id: string;
  category_id: string | null;
  needs_review: boolean | null;
  is_validated: boolean | null;
  created_at: string | null;
  data_changed_at: string | null;
}

export interface ReadinessInput {
  year: number;
  month: number;
  accounts: ReadinessAccount[];
  /** Snapshots dated M-01 .. (M+1)-01 inclusive. */
  snapshots: ReadinessSnapshot[];
  /** Transactions dated in M. */
  transactions: ReadinessTransaction[];
  report: { generated_at: string } | null;
}

const TRANSACTIONAL_TYPES = new Set(['current', 'credit']);
const MONTHS = MONTH_NAMES;

const pad = (n: number) => String(n).padStart(2, '0');

export function monthBounds(year: number, month: number): { start: string; end: string; next: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}`, next: `${ny}-${pad(nm)}-01` };
}

/** UTC instant of 00:00 Europe/London on a calendar date (handles GMT/BST). */
export function ukMidnightUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(guess))
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const mt = /GMT([+-]\d+)?(?::(\d+))?/.exec(name);
  const offsetMin = mt?.[1] ? Number(mt[1]) * 60 + Math.sign(Number(mt[1])) * Number(mt[2] ?? 0) : 0;
  return new Date(guess - offsetMin * 60_000);
}

/** 00:00 UK on the 2nd of M+1: syncs at or after this have the month-end postings. */
export function syncCutoff(year: number, month: number): Date {
  const { next } = monthBounds(year, month);
  return ukMidnightUtc(`${next.slice(0, 8)}02`);
}

/** The month before `now` in UK time — the one being closed. */
export function previousMonthUk(now: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric' })
    .formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

const changedAt = (r: { created_at: string | null; data_changed_at: string | null }): string | null =>
  r.data_changed_at ?? r.created_at;

const maxIso = (a: string | null, b: string | null): string | null =>
  !a ? b : !b ? a : new Date(a) >= new Date(b) ? a : b;

const after = (a: string | null, b: string): boolean => !!a && new Date(a).getTime() > new Date(b).getTime();

function fmtDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Pure: everything the endpoint returns, from already-loaded rows. */
export function evaluateReadiness(input: ReadinessInput): MonthReadiness {
  const { year, month } = input;
  const { start, next } = monthBounds(year, month);
  const live = input.accounts.filter((a) => !a.is_archived);
  const liveIds = new Set(live.map((a) => a.id));
  const nameOf = new Map(input.accounts.map((a) => [a.id, a.name]));
  const txs = input.transactions.filter((t) => liveIds.has(t.account_id));
  const snaps = input.snapshots.filter((s) => liveIds.has(s.account_id));

  // wealth
  const needSnapshot = live.filter(
    (a) => a.include_in_net_worth === true && a.exclude_from_snapshots !== true && !TRANSACTIONAL_TYPES.has(a.type)
  );
  const haveNext = new Set(snaps.filter((s) => s.date === next).map((s) => s.account_id));
  const noSnap = needSnapshot.filter((a) => !haveNext.has(a.id)).map((a) => a.name).sort();
  const wealth: ReadinessCheck = {
    key: 'wealth',
    ok: noSnap.length === 0,
    detail: noSnap.length === 0
      ? `all ${needSnapshot.length} accounts have a ${fmtDay(next)} snapshot`
      : `${noSnap.join(', ')} missing ${fmtDay(next)} snapshot`,
    missing: noSnap,
  };

  // synced
  const cutoff = syncCutoff(year, month);
  const syncing = live.filter((a) => a.sync_enabled === true && TRANSACTIONAL_TYPES.has(a.type));
  const behind = syncing
    .filter((a) => !a.last_sync_at || new Date(a.last_sync_at).getTime() < cutoff.getTime())
    .map((a) => a.name)
    .sort();
  const synced: ReadinessCheck = {
    key: 'synced',
    ok: behind.length === 0,
    detail: behind.length === 0
      ? `${syncing.length} bank account${syncing.length === 1 ? '' : 's'} synced since ${fmtDay(next.slice(0, 8) + '02')}`
      : `${behind.join(', ')} not synced since ${fmtDay(next.slice(0, 8) + '02')}`,
    missing: behind,
  };

  // categorised
  const uncategorised = txs.filter((t) => !t.category_id || t.needs_review === true).length;
  const categorised: ReadinessCheck = {
    key: 'categorised',
    ok: uncategorised === 0,
    detail: uncategorised === 0 ? 'all categorised' : `${uncategorised} uncategorised or flagged`,
    count: uncategorised,
  };

  // validated
  const byAccount: Record<string, number> = {};
  for (const t of txs) {
    if (t.is_validated === true) continue;
    const n = nameOf.get(t.account_id) ?? t.account_id;
    byAccount[n] = (byAccount[n] ?? 0) + 1;
  }
  const unvalidated = Object.values(byAccount).reduce((s, n) => s + n, 0);
  const validated: ReadinessCheck = {
    key: 'validated',
    ok: unvalidated === 0,
    detail: unvalidated === 0 ? 'all validated' : `${unvalidated} unvalidated`,
    count: unvalidated,
    byAccount,
  };

  const checks = [wealth, synced, categorised, validated];
  const ready = checks.every((c) => c.ok);

  // What the report depends on, and when it last changed.
  let dataChangedAt: string | null = null;
  for (const t of txs) dataChangedAt = maxIso(dataChangedAt, changedAt(t));
  for (const s of snaps) if (s.date >= start && s.date <= next) dataChangedAt = maxIso(dataChangedAt, changedAt(s));

  const generatedAt = input.report?.generated_at ?? null;
  const changedSinceReport = !!generatedAt && after(dataChangedAt, generatedAt);
  const lateTransactions = generatedAt ? txs.filter((t) => after(t.created_at, generatedAt)).length : 0;

  // A current report closes the month whatever the checks say (they gate building it, not keeping
  // it). Otherwise wait until every check passes, then build or rebuild.
  const action: ReadinessAction =
    generatedAt && !changedSinceReport ? 'none' : !ready ? 'wait' : generatedAt ? 'regenerate' : 'generate';

  return {
    year,
    month,
    monthLabel: `${MONTHS[month - 1]} ${year}`,
    ready,
    checks,
    reportExists: !!generatedAt,
    reportGeneratedAt: generatedAt,
    dataChangedAt,
    changedSinceReport,
    lateTransactions,
    action,
  };
}

const PAGE = 1000;

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Load M's rows and evaluate. */
export async function getMonthReadiness(year: number, month: number): Promise<MonthReadiness> {
  const { start, end, next } = monthBounds(year, month);

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, is_archived, include_in_net_worth, exclude_from_snapshots, sync_enabled, last_sync_at');
  if (accErr) throw new Error(`Failed to read accounts: ${accErr.message}`);

  // data_changed_at isn't in the generated types until they're regenerated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const snapshots = await pageAll<ReadinessSnapshot>((from, to) =>
    db.from('wealth_snapshots')
      .select('account_id, date, created_at, data_changed_at')
      .gte('date', start)
      .lte('date', next)
      .order('id', { ascending: true })
      .range(from, to)
  );
  const transactions = await pageAll<ReadinessTransaction>((from, to) =>
    db.from('transactions')
      .select('id, account_id, category_id, needs_review, is_validated, created_at, data_changed_at')
      .gte('date', start)
      .lte('date', end)
      .order('id', { ascending: true })
      .range(from, to)
  );
  const { data: reports, error: repErr } = await db
    .from('monthly_reports')
    .select('generated_at')
    .eq('year', year)
    .eq('month', month)
    .limit(1);
  if (repErr) throw new Error(`Failed to read monthly report: ${repErr.message}`);

  return evaluateReadiness({
    year,
    month,
    accounts: (accounts ?? []) as unknown as ReadinessAccount[],
    snapshots,
    transactions,
    report: reports?.[0] ?? null,
  });
}
