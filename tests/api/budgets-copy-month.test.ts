/**
 * POST /api/budgets/copy-month: copies non-zero budgets month to month (upsert),
 * refuses to overwrite without `overwrite: true`, and returns the previous
 * target amounts for Undo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { POST } from '@/app/api/budgets/copy-month/route';

const A = '550e8400-e29b-41d4-a716-4466554400a1';
const B = '550e8400-e29b-41d4-a716-4466554400b2';
const C = '550e8400-e29b-41d4-a716-4466554400c3';

const req = (body: unknown) =>
  new NextRequest('http://localhost/api/budgets/copy-month', { method: 'POST', body: JSON.stringify(body) });

const amounts = (year: number, month: number) =>
  Object.fromEntries(
    db.current!.table('budgets')
      .filter((r) => r.year === year && r.month === month)
      .map((r) => [r.category_id as string, Number(r.amount)])
  );

describe('POST /api/budgets/copy-month', () => {
  beforeEach(() => {
    db.current = createFakeSupabase({
      budgets: [
        { id: '1', category_id: A, year: 2026, month: 9, amount: 600 },
        { id: '2', category_id: B, year: 2026, month: 9, amount: 250 },
        { id: '3', category_id: C, year: 2026, month: 9, amount: 0 },
        // Sync-created zero rows in the target month
        { id: '4', category_id: A, year: 2026, month: 10, amount: 0 },
        { id: '5', category_id: C, year: 2026, month: 10, amount: 0 },
      ],
    });
  });

  it('copies only non-zero amounts into an empty month', async () => {
    const res = await POST(req({ from: '2026-09', to: '2026-10' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.copied).toBe(2);
    expect(body.replaced).toBe(0);
    expect(amounts(2026, 10)).toEqual({ [A]: 600, [B]: 250, [C]: 0 });
    // Upsert: no duplicate row for A
    expect(db.current!.table('budgets').filter((r) => r.category_id === A && r.month === 10)).toHaveLength(1);
    expect(body.previous).toEqual(
      expect.arrayContaining([
        { categoryId: A, amount: 0 },
        { categoryId: B, amount: 0 },
      ])
    );
  });

  it('returns 409 when the target already has budgets and overwrite is not set', async () => {
    db.current!.table('budgets').push({ id: '6', category_id: B, year: 2026, month: 10, amount: 300 });
    const res = await POST(req({ from: '2026-09', to: '2026-10' }));
    expect(res.status).toBe(409);
    expect((await res.json()).existing).toBe(1);
    expect(amounts(2026, 10)[B]).toBe(300);
  });

  it('overwrites when confirmed and reports what it replaced', async () => {
    db.current!.table('budgets').push({ id: '6', category_id: B, year: 2026, month: 10, amount: 300 });
    const res = await POST(req({ from: '2026-09', to: '2026-10', overwrite: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replaced).toBe(1);
    expect(body.previous).toEqual(expect.arrayContaining([{ categoryId: B, amount: 300 }]));
    expect(amounts(2026, 10)[B]).toBe(250);
  });

  it('copies across a year boundary', async () => {
    db.current!.table('budgets').push({ id: '7', category_id: A, year: 2025, month: 12, amount: 90 });
    const res = await POST(req({ from: '2025-12', to: '2026-01' }));
    expect(res.status).toBe(200);
    expect(amounts(2026, 1)).toEqual({ [A]: 90 });
  });

  it('404s when the source month has nothing to copy', async () => {
    const res = await POST(req({ from: '2026-03', to: '2026-10' }));
    expect(res.status).toBe(404);
  });

  it('rejects bad input', async () => {
    expect((await POST(req({ from: '2026-9', to: '2026-10' }))).status).toBe(400);
    expect((await POST(req({ from: '2026-10', to: '2026-10' }))).status).toBe(400);
    expect((await POST(req({ to: '2026-10' }))).status).toBe(400);
  });
});
