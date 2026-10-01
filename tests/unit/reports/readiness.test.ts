/**
 * Month-close readiness: each check, the explicit regeneration rule, and the
 * UK-time helpers.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
import {
  evaluateReadiness,
  monthBounds,
  previousMonthUk,
  syncCutoff,
  ukMidnightUtc,
  type ReadinessAccount,
  type ReadinessInput,
  type ReadinessSnapshot,
  type ReadinessTransaction,
} from '@/lib/reports/readiness';

const acct = (id: string, name: string, type: string, o: Partial<ReadinessAccount> = {}): ReadinessAccount => ({
  id, name, type, is_archived: false, include_in_net_worth: true, exclude_from_snapshots: false,
  sync_enabled: false, last_sync_at: null, ...o,
});

const ACCOUNTS: ReadinessAccount[] = [
  acct('joint', 'HSBC Joint Current Account', 'current', { exclude_from_snapshots: true, sync_enabled: true, last_sync_at: '2026-10-02T06:00:00Z' }),
  acct('card', 'HSBC Credit Card', 'credit', { sync_enabled: true, last_sync_at: '2026-10-02T06:00:00Z' }),
  acct('isa', 'Abby S&S ISA', 'isa'),
  acct('house', 'House Net Worth', 'property'),
  acct('track', 'Investment Contributions', 'tracking', { include_in_net_worth: false, exclude_from_snapshots: true }),
  acct('cash', 'Cash Position', 'current', { exclude_from_snapshots: true }),
  acct('gma', 'HSBC Global Money Account', 'current', { is_archived: true, sync_enabled: true, last_sync_at: null }),
  acct('old', 'Old ISA', 'isa', { is_archived: true }),
];

const snap = (account_id: string, date: string, created_at = '2026-10-01T09:00:00Z', data_changed_at: string | null = null): ReadinessSnapshot =>
  ({ account_id, date, created_at, data_changed_at });

const tx = (id: string, o: Partial<ReadinessTransaction> = {}): ReadinessTransaction => ({
  id, account_id: 'joint', category_id: 'c1', needs_review: false, is_validated: true,
  created_at: '2026-09-15T10:00:00Z', data_changed_at: null, ...o,
});

const READY: ReadinessInput = {
  year: 2026,
  month: 9,
  accounts: ACCOUNTS,
  snapshots: [snap('isa', '2026-10-01'), snap('house', '2026-10-01'), snap('isa', '2026-09-01', '2026-09-01T09:00:00Z')],
  transactions: [tx('t1'), tx('t2', { account_id: 'card' })],
  report: null,
};

const check = (r: ReturnType<typeof evaluateReadiness>, key: string) => r.checks.find((c) => c.key === key)!;

describe('helpers', () => {
  it('monthBounds handles month and year ends', () => {
    expect(monthBounds(2026, 9)).toEqual({ start: '2026-09-01', end: '2026-09-30', next: '2026-10-01' });
    expect(monthBounds(2026, 12)).toEqual({ start: '2026-12-01', end: '2026-12-31', next: '2027-01-01' });
    expect(monthBounds(2028, 2).end).toBe('2028-02-29');
  });

  it('ukMidnightUtc respects BST and GMT', () => {
    expect(ukMidnightUtc('2026-10-02').toISOString()).toBe('2026-10-01T23:00:00.000Z'); // BST
    expect(ukMidnightUtc('2026-12-02').toISOString()).toBe('2026-12-02T00:00:00.000Z'); // GMT
  });

  it('syncCutoff is 00:00 UK on the 2nd of the next month', () => {
    expect(syncCutoff(2026, 9).toISOString()).toBe('2026-10-01T23:00:00.000Z');
    expect(syncCutoff(2026, 12).toISOString()).toBe('2027-01-02T00:00:00.000Z');
  });

  it('previousMonthUk uses UK time at the month boundary', () => {
    expect(previousMonthUk(new Date('2026-10-01T00:30:00+01:00'))).toEqual({ year: 2026, month: 9 });
    expect(previousMonthUk(new Date('2026-09-30T23:30:00Z'))).toEqual({ year: 2026, month: 9 }); // 00:30 BST 1 Oct
    expect(previousMonthUk(new Date('2027-01-15T12:00:00Z'))).toEqual({ year: 2026, month: 12 });
  });
});

describe('checks', () => {
  it('all pass → ready, and no report yet → generate', () => {
    const r = evaluateReadiness(READY);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r).toMatchObject({ ready: true, reportExists: false, action: 'generate', monthLabel: 'September 2026' });
  });

  it('wealth: lists non-transactional net-worth accounts missing a snapshot dated exactly the 1st of M+1', () => {
    const r = evaluateReadiness({ ...READY, snapshots: [snap('isa', '2026-09-30'), snap('house', '2026-10-01')] });
    const c = check(r, 'wealth');
    expect(c.ok).toBe(false);
    expect(c.missing).toEqual(['Abby S&S ISA']);           // a 30 Sep snapshot doesn't count
    expect(c.detail).toBe('Abby S&S ISA missing 1 Oct snapshot');
    expect(r.action).toBe('wait');
  });

  it('wealth: ignores archived, excluded-from-snapshots, not-in-net-worth and current/credit accounts', () => {
    const c = check(evaluateReadiness(READY), 'wealth');
    expect(c.ok).toBe(true);
    expect(c.detail).toBe('all 2 accounts have a 1 Oct snapshot');
  });

  it('synced: sync-enabled current/credit accounts must have synced since 00:00 UK on the 2nd', () => {
    const accounts = ACCOUNTS.map((a) => (a.id === 'card' ? { ...a, last_sync_at: '2026-10-01T22:59:00Z' } : a));
    const c = check(evaluateReadiness({ ...READY, accounts }), 'synced');
    expect(c.ok).toBe(false);
    expect(c.missing).toEqual(['HSBC Credit Card']);        // 23:59 BST on the 1st is too early
    const ok = ACCOUNTS.map((a) => (a.id === 'card' ? { ...a, last_sync_at: '2026-10-01T23:00:00Z' } : a));
    expect(check(evaluateReadiness({ ...READY, accounts: ok }), 'synced').ok).toBe(true);
  });

  it('synced: an archived sync-enabled account never blocks', () => {
    expect(check(evaluateReadiness(READY), 'synced').missing).toEqual([]);
  });

  it('categorised: counts uncategorised and flagged transactions dated in M', () => {
    const transactions = [tx('t1', { category_id: null }), tx('t2', { needs_review: true }), tx('t3')];
    const c = check(evaluateReadiness({ ...READY, transactions }), 'categorised');
    expect(c).toMatchObject({ ok: false, count: 2, detail: '2 uncategorised or flagged' });
  });

  it('validated: counts unvalidated per account, ignoring archived accounts', () => {
    const transactions = [
      tx('t1', { is_validated: false }),
      tx('t2', { is_validated: false, account_id: 'card' }),
      tx('t3', { is_validated: false, account_id: 'card' }),
      tx('t4', { is_validated: false, account_id: 'gma' }),   // archived → excluded
      tx('t5'),
    ];
    const c = check(evaluateReadiness({ ...READY, transactions }), 'validated');
    expect(c).toMatchObject({ ok: false, count: 3, byAccount: { 'HSBC Joint Current Account': 1, 'HSBC Credit Card': 2 } });
  });
});

describe('regeneration rule (never regenerate unless data changed after generated_at)', () => {
  const report = { generated_at: '2026-10-02T08:00:00Z' };

  it('report exists and nothing changed since → none', () => {
    const r = evaluateReadiness({ ...READY, report });
    expect(r).toMatchObject({ reportExists: true, changedSinceReport: false, lateTransactions: 0, action: 'none' });
  });

  it('a current report closes the month even while a check fails (e.g. the 1st, before the 2nd’s sync)', () => {
    const accounts = ACCOUNTS.map((a) => (a.sync_enabled ? { ...a, last_sync_at: '2026-10-01T06:00:00Z' } : a));
    const r = evaluateReadiness({ ...READY, accounts, report });
    expect(r).toMatchObject({ ready: false, reportExists: true, changedSinceReport: false, action: 'none' });
  });

  it('a late transaction dated in M: stale, waits while unvalidated, regenerates once validated', () => {
    const late = tx('late', { created_at: '2026-10-03T07:00:00Z', is_validated: false });
    const waiting = evaluateReadiness({ ...READY, report, transactions: [...READY.transactions, late] });
    expect(waiting).toMatchObject({ changedSinceReport: true, lateTransactions: 1, ready: false, action: 'wait' });
    const validated = evaluateReadiness({ ...READY, report, transactions: [...READY.transactions, { ...late, is_validated: true }] });
    expect(validated).toMatchObject({ ready: true, action: 'regenerate', lateTransactions: 1 });
  });

  it('an edit (data_changed_at) after the report → regenerate; older rows use created_at', () => {
    const edited = tx('t1', { data_changed_at: '2026-10-04T12:00:00Z' });
    expect(evaluateReadiness({ ...READY, report, transactions: [edited] }).action).toBe('regenerate');
    const oldEdit = tx('t1', { data_changed_at: '2026-10-01T12:00:00Z' });
    expect(evaluateReadiness({ ...READY, report, transactions: [oldEdit] }).action).toBe('none');
  });

  it('a wealth snapshot changed after the report → regenerate (report generated before data was ready)', () => {
    const snapshots = [snap('isa', '2026-10-01', '2026-10-02T09:00:00Z'), snap('house', '2026-10-01')];
    expect(evaluateReadiness({ ...READY, report, snapshots }).action).toBe('regenerate');
  });

  it('a snapshot outside M-01..(M+1)-01 never makes the report stale', () => {
    const snapshots = [...READY.snapshots, snap('isa', '2026-11-01', '2026-11-01T09:00:00Z')];
    expect(evaluateReadiness({ ...READY, report, snapshots }).action).toBe('none');
  });

  it('changes on archived accounts are ignored', () => {
    const transactions = [...READY.transactions, tx('g', { account_id: 'gma', created_at: '2026-10-05T00:00:00Z' })];
    expect(evaluateReadiness({ ...READY, report, transactions })).toMatchObject({ action: 'none', lateTransactions: 0 });
  });
});
