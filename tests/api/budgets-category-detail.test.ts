/**
 * GET /api/budgets/category/[id] against an in-memory DB: period totals match
 * the sign-aware budget maths, other categories are ignored, the last 3
 * transactions come back newest first with their account, and bad input is
 * rejected.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const fake = vi.hoisted(() => ({ db: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return fake.db!.client;
  },
}));

import { GET } from '@/app/api/budgets/category/[id]/route';

const CAT = '00000000-0000-4000-a000-0000000000c1';
const OTHER = '00000000-0000-4000-a000-0000000000c2';
const ACC = '00000000-0000-4000-a000-0000000000a1';

function seed() {
  fake.db = createFakeSupabase({
    categories: [
      { id: CAT, name: 'Eating out', group_name: 'Entertainment', is_income: false },
      { id: OTHER, name: 'Groceries', group_name: 'Food', is_income: false },
    ],
    accounts: [{ id: ACC, name: 'HSBC Joint' }],
    budgets: [
      { id: 'b1', category_id: CAT, year: 2026, month: 9, amount: 350 },
      { id: 'b2', category_id: CAT, year: 2026, month: 8, amount: 350 },
      { id: 'b3', category_id: OTHER, year: 2026, month: 9, amount: 600 },
    ],
    transactions: [
      { id: 't1', category_id: CAT, account_id: ACC, date: '2026-09-25', description: 'CAFE DES AMIS', amount: -41.33 },
      { id: 't2', category_id: CAT, account_id: ACC, date: '2026-09-17', description: 'LEON', amount: -11.84 },
      { id: 't3', category_id: CAT, account_id: ACC, date: '2026-09-09', description: 'REFUND', amount: 5 },
      { id: 't4', category_id: CAT, account_id: ACC, date: '2026-08-02', description: 'NANDOS', amount: -60 },
      { id: 't5', category_id: OTHER, account_id: ACC, date: '2026-09-10', description: 'TESCO', amount: -99 },
      { id: 't6', category_id: CAT, account_id: ACC, date: '2026-10-03', description: 'AFTER PERIOD', amount: -20 },
    ],
  });
}

const call = (id: string, qs: string) =>
  GET(new NextRequest(`http://localhost/api/budgets/category/${id}?${qs}`), { params: Promise.resolve({ id }) });

describe('GET /api/budgets/category/[id]', () => {
  it('returns the month in detail', async () => {
    seed();
    const res = await call(CAT, 'year=2026&month=9');
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.category).toEqual({ id: CAT, name: 'Eating out', groupName: 'Entertainment', isIncome: false });
    expect(d.budget).toBe(350);
    expect(d.actual).toBe(48.17); // 41.33 + 11.84 - 5 refund
    expect(d.count).toBe(3);
    expect(d.months).toHaveLength(12);
    expect(d.months.at(-1)).toMatchObject({ key: '2026-09', actual: 48.17, budget: 350 });
    expect(d.months.at(-2)).toMatchObject({ key: '2026-08', actual: 60, budget: 350 });
    expect(d.recent.map((r: { description: string }) => r.description)).toEqual(['CAFE DES AMIS', 'LEON', 'REFUND']);
    expect(d.recent[0].account).toBe('HSBC Joint');
  });

  it('returns the year when no month is given', async () => {
    seed();
    const d = await (await call(CAT, 'year=2026')).json();
    expect(d.period).toMatchObject({ view: 'year', label: '2026', from: '2026-01-01', to: '2026-12-31' });
    expect(d.budget).toBe(700);
    expect(d.actual).toBe(128.17);
    expect(d.count).toBe(5);
  });

  it('rejects bad input and unknown categories', async () => {
    seed();
    expect((await call('nope', 'year=2026')).status).toBe(400);
    expect((await call(CAT, 'year=2026&month=13')).status).toBe(400);
    expect((await call('00000000-0000-4000-a000-0000000000ff', 'year=2026')).status).toBe(404);
  });
});
