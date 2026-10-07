import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

// GET /api/transactions (status filters + totals) and GET /api/transactions/ids
// against an in-memory supabase.
const fake = vi.hoisted(() => ({ db: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return fake.db!.client;
  },
}));

import { GET } from '@/app/api/transactions/route';
import { GET as GET_IDS } from '@/app/api/transactions/ids/route';

const ACC_A = '00000000-0000-4000-a000-00000000000a';
const ACC_B = '00000000-0000-4000-a000-00000000000b';
const CAT_FOOD = '00000000-0000-4000-a000-0000000000f0';

function uuid(n: number): string {
  return `10000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
}

function tx(n: number, over: Record<string, unknown> = {}) {
  return {
    id: uuid(n),
    date: '2026-10-07',
    amount: -10,
    description: `Row ${n}`,
    account_id: ACC_A,
    category_id: CAT_FOOD,
    categorisation_source: 'manual',
    is_validated: false,
    needs_review: false,
    ...over,
  };
}

function seed(rows: Record<string, unknown>[]) {
  fake.db = createFakeSupabase({
    transactions: rows,
    accounts: [
      { id: ACC_A, name: 'Current' },
      { id: ACC_B, name: 'Savings' },
    ],
    categories: [{ id: CAT_FOOD, name: 'Groceries', group_name: 'Food' }],
  });
}

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/transactions${qs}`));
const getIds = (qs: string) => GET_IDS(new NextRequest(`http://localhost/api/transactions/ids${qs}`));

describe('GET /api/transactions', () => {
  beforeEach(() => {
    seed([
      tx(1, { amount: -12.5, description: 'TESCO STORES 123' }),
      tx(2, { amount: 2000, description: 'SALARY ACME', category_id: null }),
      tx(3, { amount: -7.25, needs_review: true, description: 'Tesco Express' }),
      tx(4, { amount: -30, is_validated: true, account_id: ACC_B }),
      tx(5, { amount: 15, category_id: null, is_validated: true }),
    ]);
  });

  it('keeps the data/total shape and adds totals {out, in} for the whole filtered set', async () => {
    const res = await get('?limit=2');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.totals).toEqual({ out: 49.75, in: 2015 });
  });

  it('totals follow the filters', async () => {
    const body = await (await get(`?account_id=${ACC_B}`)).json();
    expect(body.total).toBe(1);
    expect(body.totals).toEqual({ out: 30, in: 0 });
  });

  it('skips totals with totals=0', async () => {
    const body = await (await get('?totals=0')).json();
    expect(body.total).toBe(5);
    expect(body.totals).toBeUndefined();
  });

  it('status=uncategorised returns rows with no category', async () => {
    const body = await (await get('?status=uncategorised')).json();
    expect(body.data.map((r: { id: string }) => r.id).sort()).toEqual([uuid(2), uuid(5)]);
    expect(body.total).toBe(2);
  });

  it('status=needs_review returns flagged rows', async () => {
    const body = await (await get('?status=needs_review')).json();
    expect(body.data.map((r: { id: string }) => r.id)).toEqual([uuid(3)]);
    expect(body.totals).toEqual({ out: 7.25, in: 0 });
  });

  it('status=validated returns validated rows', async () => {
    const body = await (await get('?status=validated')).json();
    expect(body.data.map((r: { id: string }) => r.id).sort()).toEqual([uuid(4), uuid(5)]);
  });

  it('combines status with search (case-insensitive)', async () => {
    const body = await (await get('?search=tesco&status=needs_review')).json();
    expect(body.total).toBe(1);
    const all = await (await get('?search=tesco')).json();
    expect(all.total).toBe(2);
  });

  it('rejects an unknown status', async () => {
    const res = await get('?status=bogus');
    expect(res.status).toBe(400);
  });

  it('embeds account and category names', async () => {
    const body = await (await get(`?account_id=${ACC_B}`)).json();
    expect(body.data[0].account).toEqual({ name: 'Savings' });
    expect(body.data[0].category).toEqual({ name: 'Groceries', group_name: 'Food' });
  });
});

describe('GET /api/transactions/ids', () => {
  it('returns every matching id with amount/description/flag/category', async () => {
    seed([
      tx(1, { amount: -5, category_id: null }),
      tx(2, { amount: -6, needs_review: true }),
      tx(3, { amount: 7, category_id: null }),
    ]);
    const res = await getIds('?status=uncategorised');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ids.sort()).toEqual([uuid(1), uuid(3)]);
    expect(body.total).toBe(2);
    expect(body.capped).toBe(false);
    const row = body.rows.find((r: { id: string }) => r.id === uuid(3));
    expect(row).toEqual({ id: uuid(3), amount: 7, description: 'Row 3', needs_review: false, category_id: null });
  });

  it('pages past 1000 rows and caps at 2000', async () => {
    seed(Array.from({ length: 2105 }, (_, i) => tx(i + 1)));
    const body = await (await getIds('')).json();
    expect(body.total).toBe(2105);
    expect(body.ids).toHaveLength(2000);
    expect(new Set(body.ids).size).toBe(2000);
    expect(body.capped).toBe(true);
  });

  it('applies the same filters as the list', async () => {
    seed([tx(1, { account_id: ACC_B }), tx(2), tx(3, { account_id: ACC_B, is_validated: true })]);
    const body = await (await getIds(`?account_id=${ACC_B}&status=validated`)).json();
    expect(body.ids).toEqual([uuid(3)]);
  });

  it('validates the query', async () => {
    seed([]);
    const res = await getIds('?account_id=not-a-uuid');
    expect(res.status).toBe(400);
  });
});
