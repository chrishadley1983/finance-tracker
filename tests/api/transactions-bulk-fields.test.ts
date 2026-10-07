import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

// PUT /api/transactions/bulk for is_validated / needs_review / account_id
// against an in-memory supabase.
const fake = vi.hoisted(() => ({ db: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return fake.db!.client;
  },
}));

const mockApply = vi.hoisted(() => vi.fn());
vi.mock('@/lib/categorisation/apply', () => ({
  applyManualCategories: mockApply,
  InvalidCategoryError: class InvalidCategoryError extends Error {},
}));

import { PUT, DELETE } from '@/app/api/transactions/bulk/route';

const ACC_A = '00000000-0000-4000-a000-00000000000a';
const ACC_B = '00000000-0000-4000-a000-00000000000b';
const CAT = '00000000-0000-4000-a000-0000000000c1';
const id = (n: number) => `10000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

function seed(count = 3) {
  fake.db = createFakeSupabase({
    transactions: Array.from({ length: count }, (_, i) => ({
      id: id(i + 1),
      date: '2026-10-01',
      amount: -1,
      description: `Row ${i + 1}`,
      account_id: i === 0 ? ACC_B : ACC_A,
      category_id: null,
      is_validated: i === 1,
      needs_review: i === 2,
    })),
  });
}

const put = (body: unknown) =>
  PUT(new NextRequest('http://localhost/api/transactions/bulk', { method: 'PUT', body: JSON.stringify(body) }));

const row = (n: number) => fake.db!.tables.transactions.find((r) => r.id === id(n))!;

describe('PUT /api/transactions/bulk (validation, review flag, account)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApply.mockImplementation(async (items: { transactionIds: string[]; categoryId: string }[]) =>
      items.map((i) => ({ categoryId: i.categoryId, requested: i.transactionIds.length, applied: i.transactionIds.length, missing: [], corrections: 0 }))
    );
    seed();
  });

  it('marks rows validated and returns their previous values for undo', async () => {
    const res = await put({ ids: [id(1), id(2), id(3)], update: { is_validated: true } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.updated).toBe(3);
    expect([row(1), row(2), row(3)].every((r) => r.is_validated === true)).toBe(true);
    const prev = Object.fromEntries(body.previous.map((p: { id: string; is_validated: boolean }) => [p.id, p.is_validated]));
    expect(prev).toEqual({ [id(1)]: false, [id(2)]: true, [id(3)]: false });
  });

  it('sets and clears the review flag', async () => {
    await put({ ids: [id(1)], update: { needs_review: true } });
    expect(row(1).needs_review).toBe(true);
    const res = await put({ ids: [id(1), id(3)], update: { needs_review: false } });
    const body = await res.json();
    expect(row(1).needs_review).toBe(false);
    expect(row(3).needs_review).toBe(false);
    expect(body.previous.find((p: { id: string }) => p.id === id(3)).needs_review).toBe(true);
  });

  it('moves rows to another account and reports the old account', async () => {
    const res = await put({ ids: [id(1), id(2)], update: { account_id: ACC_B } });
    const body = await res.json();
    expect(row(2).account_id).toBe(ACC_B);
    expect(body.previous.find((p: { id: string }) => p.id === id(2)).account_id).toBe(ACC_A);
    expect(body.previous.find((p: { id: string }) => p.id === id(1)).account_id).toBe(ACC_B);
  });

  it('category changes still go through applyManualCategories (no previous values)', async () => {
    const res = await put({ ids: [id(1)], update: { category_id: CAT } });
    const body = await res.json();
    expect(mockApply).toHaveBeenCalledWith([{ transactionIds: [id(1)], categoryId: CAT }]);
    expect(body.previous).toBeUndefined();
  });

  it('can combine a category with a validation change', async () => {
    await put({ ids: [id(1)], update: { category_id: CAT, is_validated: true } });
    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(row(1).is_validated).toBe(true);
  });

  it('rejects a non-boolean flag and a bad account id', async () => {
    expect((await put({ ids: [id(1)], update: { is_validated: 'yes' } })).status).toBe(400);
    expect((await put({ ids: [id(1)], update: { account_id: 'nope' } })).status).toBe(400);
  });

  it('rejects more than 2000 ids', async () => {
    const ids = Array.from({ length: 2001 }, (_, i) => id(i + 1));
    expect((await put({ ids, update: { is_validated: true } })).status).toBe(400);
  });

  it('updates large selections in chunks', async () => {
    seed(450);
    const ids = Array.from({ length: 450 }, (_, i) => id(i + 1));
    const res = await put({ ids, update: { needs_review: true } });
    const body = await res.json();
    expect(body.updated).toBe(450);
    expect(body.previous).toHaveLength(450);
    expect(fake.db!.tables.transactions.every((r) => r.needs_review === true)).toBe(true);
  });
});

describe('DELETE /api/transactions/bulk (chunked)', () => {
  it('deletes more than one chunk of ids', async () => {
    seed(450);
    const ids = Array.from({ length: 450 }, (_, i) => id(i + 1));
    const res = await DELETE(
      new NextRequest('http://localhost/api/transactions/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) })
    );
    expect(res.status).toBe(200);
    expect(fake.db!.tables.transactions).toHaveLength(0);
  });
});
