import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';
import { csvField, isIsoDate, EXPORT_TABLES } from '@/lib/export';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { GET as getStats } from '@/app/api/settings/stats/route';
import { GET as getCsv } from '@/app/api/export/transactions.csv/route';
import { GET as getAll } from '@/app/api/export/all.json/route';

const tx = (id: string, date: string, description: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  date,
  description,
  amount,
  account_id: 'acc-1',
  category_id: 'cat-1',
  needs_review: false,
  is_validated: true,
  ...extra,
});

function seed() {
  db.current = createFakeSupabase({
    accounts: [
      { id: 'acc-1', name: 'Joint Current' },
      { id: 'acc-2', name: 'Savings' },
    ],
    categories: [
      { id: 'cat-1', name: 'Groceries' },
      { id: 'cat-2', name: 'Salary' },
      { id: 'cat-3', name: 'Eating out' },
    ],
    category_mappings: [{ id: 'r-1' }],
    budgets: [{ id: 'b-1' }, { id: 'b-2' }],
    wealth_snapshots: [{ id: 'w-1' }],
    subscriptions: [],
    transactions: [
      tx('t-1', '2026-08-03', 'Tesco Stores', -42.1),
      tx('t-2', '2026-09-28', 'ACME LTD SALARY', 3200, { category_id: 'cat-2' }),
      tx('t-3', '2026-10-02', 'Pizza, "the good one"', -18.5, { category_id: null, needs_review: true, is_validated: false }),
    ],
    truelayer_connections: [{ id: 'c-1', access_token: 'secret-token' }],
  });
}

const csvReq = (qs = '') => new NextRequest(`http://localhost/api/export/transactions.csv${qs}`);

describe('GET /api/settings/stats', () => {
  beforeEach(seed);

  it('returns real head counts for each table and the transaction date span', async () => {
    const res = await getStats();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counts).toEqual({
      transactions: 3,
      accounts: 2,
      categories: 3,
      rules: 1,
      budgets: 2,
      snapshots: 1,
      subscriptions: 0,
    });
    expect(body.transactions).toEqual({ first: '2026-08-03', last: '2026-10-02' });
    expect(body.about.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('returns 500 when a count fails', async () => {
    const client = db.current!.client;
    const from = client.from;
    client.from = (name: string) => {
      if (name === 'budgets') {
        return { select: () => Promise.resolve({ count: null, error: { message: 'boom' } }) } as never;
      }
      return from(name);
    };
    const res = await getStats();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/counts/);
  });
});

describe('GET /api/export/transactions.csv', () => {
  beforeEach(seed);

  it('streams a CSV attachment with a header and one line per transaction', async () => {
    const res = await getCsv(csvReq());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/csv/);
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="transactions-\d{4}-\d{2}-\d{2}\.csv"$/);
    const text = (await res.text()).replace(/^\uFEFF/, '');
    const lines = text.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Date,Description,Amount,Account,Category,Needs review,Validated,Id');
    expect(lines).toHaveLength(4);
    expect(lines).toContain('2026-08-03,Tesco Stores,-42.10,Joint Current,Groceries,no,yes,t-1');
    expect(lines).toContain('2026-10-02,"Pizza, ""the good one""",-18.50,Joint Current,,yes,no,t-3');
  });

  it('filters by from/to and names the file after the range', async () => {
    const res = await getCsv(csvReq('?from=2026-09-01&to=2026-09-30'));
    const lines = (await res.text()).trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('ACME LTD SALARY,3200.00');
    expect(res.headers.get('Content-Disposition')).toContain('transactions-2026-09-01-to-2026-09-30.csv');
  });

  it('rejects bad dates and reversed ranges', async () => {
    expect((await getCsv(csvReq('?from=2026-13-01'))).status).toBe(400);
    expect((await getCsv(csvReq('?from=yesterday'))).status).toBe(400);
    expect((await getCsv(csvReq('?from=2026-10-01&to=2026-09-01'))).status).toBe(400);
  });

  it('pages through more than one batch', async () => {
    const many = Array.from({ length: 2101 }, (_, i) =>
      tx(`t-${String(i).padStart(5, '0')}`, '2026-01-01', `Row ${i}`, -1)
    );
    db.current = createFakeSupabase({ transactions: many, accounts: [], categories: [] });
    const lines = (await (await getCsv(csvReq())).text()).trimEnd().split('\r\n');
    expect(lines).toHaveLength(2102);
  });
});

describe('GET /api/export/all.json', () => {
  beforeEach(seed);

  it('streams every exported table as JSON and leaves out connection tokens', async () => {
    const res = await getAll();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="finance-backup-.*\.json"$/);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(Object.keys(body.tables)).toEqual([...EXPORT_TABLES]);
    expect(body.tables.transactions).toHaveLength(3);
    expect(body.tables.accounts.map((a: { name: string }) => a.name)).toEqual(['Joint Current', 'Savings']);
    expect(body.tables.planning_notes).toEqual([]);
    expect(text).not.toContain('secret-token');
  });
});

describe('export helpers', () => {
  it('escapes CSV fields and neutralises formulas', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('-12.50')).toBe('-12.50');
    expect(csvField(null)).toBe('');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26-02-01')).toBe(false);
  });
});
