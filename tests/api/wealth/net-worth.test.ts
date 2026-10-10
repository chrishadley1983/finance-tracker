/**
 * GET /api/wealth/net-worth and /api/wealth/history against an in-memory DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { GET as netWorth } from '@/app/api/wealth/net-worth/route';
import { GET as history } from '@/app/api/wealth/history/route';

type Row = Record<string, unknown>;
const acct = (id: string, type: string, extra: Row = {}) => ({ id, name: `Acc ${id}`, type, is_active: true, include_in_net_worth: true, ...extra });

/** Balance RPC: the live rule — newest snapshot plus transactions dated on or after it (t.date >= snapshot_date). */
function seed(accounts: Row[], snapshots: Row[] = [], transactions: Row[] = []) {
  db.current = createFakeSupabase(
    {
      accounts,
      wealth_snapshots: snapshots.map((s, i) => ({ id: `s${i}`, ...s })),
      investment_valuations: [],
      transactions: transactions.map((t, i) => ({ id: `t${i}`, ...t })),
    },
    {
      get_account_balances_with_snapshots: (args) =>
        (args.account_ids as string[]).map((id) => {
          const snaps = db.current!.tables.wealth_snapshots.filter((s) => s.account_id === id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          const last = snaps[snaps.length - 1];
          const base = last ? Number(last.balance) : 0;
          const txSum = db.current!.tables.transactions
            .filter((t) => t.account_id === id && (!last || String(t.date) >= String(last.date)))
            .reduce((s, t) => s + Number(t.amount), 0);
          return { account_id: id, snapshot_date: last?.date ?? null, snapshot_balance: base, transactions_sum: txSum, current_balance: base + txSum };
        }),
    },
  );
}

describe('GET /api/wealth/net-worth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('returns an empty summary when there are no accounts', async () => {
    seed([]);
    const body = await (await netWorth()).json();
    expect(body).toMatchObject({ total: 0, previousTotal: null, change: null, byType: [], byAccount: [] });
  });

  it('totals balances by account and by type', async () => {
    seed([acct('p', 'pension'), acct('i', 'isa')], [
      { account_id: 'p', date: '2026-10-01', balance: 300 },
      { account_id: 'i', date: '2026-10-01', balance: 100 },
    ]);
    const body = await (await netWorth()).json();
    expect(body.total).toBe(400);
    expect(body.byType.map((t: Row) => [t.type, t.total])).toEqual([['pension', 300], ['isa', 100]]);
    expect(body.byAccount.map((a: Row) => a.accountId)).toEqual(['p', 'i']);
  });

  it('leaves out accounts marked include_in_net_worth = false', async () => {
    seed([acct('p', 'pension'), acct('kid', 'isa', { include_in_net_worth: false })], [
      { account_id: 'p', date: '2026-10-01', balance: 300 },
      { account_id: 'kid', date: '2026-10-01', balance: 5_000 },
    ]);
    const body = await (await netWorth()).json();
    expect(body.total).toBe(300);
    expect(body.byAccount.map((a: Row) => a.accountId)).toEqual(['p']);
  });

  it('"since last month" values last month-end the same way as today (snapshot + transactions)', async () => {
    seed(
      [acct('c', 'current')],
      [{ account_id: 'c', date: '2026-02-01', balance: 2_000 }], // seeded in February only
      [
        { account_id: 'c', date: '2026-05-01', amount: 9_000 }, // months of movement before September
        { account_id: 'c', date: '2026-10-05', amount: 1_000 }, // this month's movement
      ],
    );
    const body = await (await netWorth()).json();
    expect(body.total).toBe(12_000);
    expect(body.previousTotal).toBe(11_000); // 30 Sep: 2,000 + 9,000 (the old code compared with the raw 2,000)
    expect(body.change).toBe(1_000);
  });

  it('a newly added account is not counted as a gain since last month', async () => {
    seed([acct('p', 'pension'), acct('new', 'isa')], [
      { account_id: 'p', date: '2026-09-01', balance: 300 },
      { account_id: 'p', date: '2026-10-01', balance: 310 },
      { account_id: 'new', date: '2026-10-01', balance: 20_000 }, // opened this month
    ]);
    const body = await (await netWorth()).json();
    expect(body.total).toBe(20_310);
    expect(body.change).toBe(10);
  });

  it('reports a change against a zero or negative previous total', async () => {
    seed([acct('cc', 'credit')], [{ account_id: 'cc', date: '2026-08-01', balance: -500 }], [
      { account_id: 'cc', date: '2026-10-02', amount: 200 },
    ]);
    const body = await (await netWorth()).json();
    expect(body.previousTotal).toBe(-500);
    expect(body.change).toBe(200);
  });
});

describe('GET /api/wealth/history', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const req = (period = 'all') => new NextRequest(`http://localhost/api/wealth/history?period=${period}`);

  it('carries each account forward, includes investment snapshots, and skips excluded accounts', async () => {
    seed(
      [acct('a', 'pension'), acct('b', 'pension'), acct('g', 'investment'), acct('kid', 'isa', { include_in_net_worth: false })],
      [
        { account_id: 'a', date: '2026-08-01', balance: 200 },
        { account_id: 'b', date: '2026-08-01', balance: 100 },
        { account_id: 'g', date: '2026-08-01', balance: 50 },
        { account_id: 'kid', date: '2026-08-01', balance: 9_999 },
        { account_id: 'a', date: '2026-09-01', balance: 210 },
      ],
    );
    const body = await (await history(req())).json();
    expect(body.snapshots.map((p: Row) => [p.date, p.total])).toEqual([
      ['2026-08-01', 350],
      ['2026-09-01', 360],
      ['2026-10-01', 360],
    ]);
  });

  it("the latest point equals the headline, including a transaction on the snapshot's own date", async () => {
    seed([acct('c', 'current')], [{ account_id: 'c', date: '2026-10-01', balance: 1_000 }], [
      { account_id: 'c', date: '2026-10-01', amount: 50 },
      { account_id: 'c', date: '2026-10-04', amount: -20 },
    ]);
    const headline = (await (await netWorth()).json()).total;
    const latest = (await (await history(req())).json()).snapshots.at(-1).total;
    expect(headline).toBe(1_030);
    expect(latest).toBe(headline);
  });

  it('a period still uses earlier snapshots as starting balances', async () => {
    seed([acct('a', 'pension')], [{ account_id: 'a', date: '2023-01-01', balance: 100 }]);
    const body = await (await history(req('1y'))).json();
    expect(body.snapshots).toEqual([{ date: '2026-10-01', total: 100, byType: { pension: 100 } }]);
  });
});
