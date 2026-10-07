/**
 * GET/POST /api/transactions/validate-matching against an in-memory DB:
 * counts and validates only not-yet-validated rows matching the list filters,
 * across more rows than one page or one bulk request, and returns the ids it
 * changed (for Undo).
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

import { GET, POST } from '@/app/api/transactions/validate-matching/route';

const ACC_A = '00000000-0000-4000-a000-00000000000a';
const ACC_B = '00000000-0000-4000-a000-00000000000b';
const uuid = (n: number) => `10000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

function tx(n: number, over: Record<string, unknown> = {}) {
  return { id: uuid(n), date: '2026-10-07', amount: -10, description: `Row ${n}`, account_id: ACC_A, is_validated: false, ...over };
}

const url = (qs = '') => `http://localhost/api/transactions/validate-matching${qs ? `?${qs}` : ''}`;

describe('/api/transactions/validate-matching', () => {
  it('counts only unvalidated rows matching the filters', async () => {
    fake.db = createFakeSupabase({
      transactions: [tx(1), tx(2, { is_validated: true }), tx(3, { account_id: ACC_B }), tx(4)],
    });
    const res = await GET(new NextRequest(url(`account_id=${ACC_A}`)));
    expect(await res.json()).toEqual({ count: 2 });
  });

  it('validates every matching row and returns the changed ids', async () => {
    fake.db = createFakeSupabase({
      transactions: [tx(1), tx(2, { is_validated: true }), tx(3, { account_id: ACC_B }), tx(4)],
    });
    const res = await POST(new NextRequest(url(`account_id=${ACC_A}`), { method: 'POST' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ updated: 2, capped: false });
    expect(body.ids.sort()).toEqual([uuid(1), uuid(4)]);
    const byId = Object.fromEntries(fake.db.tables.transactions.map((t) => [t.id, t.is_validated]));
    expect(byId).toEqual({ [uuid(1)]: true, [uuid(2)]: true, [uuid(3)]: false, [uuid(4)]: true });
  });

  it('handles more rows than one page and one bulk request', async () => {
    fake.db = createFakeSupabase({ transactions: Array.from({ length: 2500 }, (_, i) => tx(i + 1)) });
    const body = await (await POST(new NextRequest(url(), { method: 'POST' }))).json();
    expect(body.updated).toBe(2500);
    expect(fake.db.tables.transactions.every((t) => t.is_validated)).toBe(true);
  });

  it('rejects malformed filters', async () => {
    fake.db = createFakeSupabase({ transactions: [] });
    const res = await POST(new NextRequest(url('account_id=nope'), { method: 'POST' }));
    expect(res.status).toBe(400);
  });
});
