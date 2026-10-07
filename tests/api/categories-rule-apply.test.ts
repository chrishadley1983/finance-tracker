/**
 * "Apply rule to existing transactions": only undecided rows (uncategorised or
 * in review, not manual, not validated) are counted and changed.
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

import { GET, POST } from '@/app/api/categories/rules/[id]/apply/route';

const GROC = '11111111-1111-4111-8111-111111111111';
const FUN = '22222222-2222-4222-8222-222222222222';
const RULE = '33333333-3333-4333-8333-333333333333';
const ASK = '44444444-4444-4444-8444-444444444444';
const tx = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method = 'GET') => new NextRequest(`http://localhost/api/categories/rules/x/apply`, { method });

function row(id: string, extra: Record<string, unknown>) {
  return { id, date: '2026-10-01', description: 'ALDI STORES 123', amount: -20, account_id: 'a', category_id: null, categorisation_source: 'ai', is_validated: false, needs_review: false, engine_source: null, ...extra };
}

beforeEach(() => {
  db.current = createFakeSupabase({
    categories: [
      { id: GROC, name: 'Groceries' },
      { id: FUN, name: 'Fun' },
    ],
    category_mappings: [
      { id: RULE, pattern: 'aldi', category_id: GROC, match_type: 'contains', confidence: 0.9, is_system: false, action: null },
      { id: ASK, pattern: 'aldi', category_id: GROC, match_type: 'contains', confidence: 0.9, is_system: true, action: 'ask' },
    ],
    transactions: [
      row(tx(1), { category_id: null }), // uncategorised: eligible
      row(tx(2), { category_id: FUN, needs_review: true, date: '2026-10-03' }), // in review: eligible
      row(tx(3), { category_id: null, categorisation_source: 'manual' }), // manual: never
      row(tx(4), { category_id: FUN, needs_review: true, is_validated: true }), // validated: never
      row(tx(5), { category_id: FUN, needs_review: false }), // decided: never
      row(tx(6), { category_id: null, description: 'VIVALDI RESTAURANT' }), // doesn't match
    ],
    category_corrections: [],
    category_rule_events: [],
  });
});

describe('GET /api/categories/rules/[id]/apply', () => {
  it('counts only uncategorised and in-review rows the rule matches', async () => {
    const res = await GET(req(), params(RULE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eligible).toBe(2);
    expect(body.uncategorised).toBe(1);
    expect(body.inReview).toBe(1);
    expect(body.applicable).toBe(true);
    expect(body.rule.category_name).toBe('Groceries');
    expect(body.sample.map((s: { id: string }) => s.id).sort()).toEqual([tx(1), tx(2)]);
  });

  it('reports an ask policy as not applicable', async () => {
    const body = await (await GET(req(), params(ASK))).json();
    expect(body.applicable).toBe(false);
    expect(body.eligible).toBe(0);
  });

  it('404s for an unknown rule and 400s for a bad id', async () => {
    expect((await GET(req(), params('55555555-5555-4555-8555-555555555555'))).status).toBe(404);
    expect((await GET(req(), params('nope'))).status).toBe(400);
  });
});

describe('POST /api/categories/rules/[id]/apply', () => {
  it('categorises the eligible rows and leaves manual, validated and decided rows alone', async () => {
    const res = await POST(req('POST'), params(RULE));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ applied: 2, categoryId: GROC, categoryName: 'Groceries' });

    const rows = await db.current!.client.from('transactions').select('*');
    const byId = new Map((rows.data as { id: string }[]).map((r) => [r.id, r as Record<string, unknown>]));
    expect(byId.get(tx(1))).toMatchObject({ category_id: GROC, categorisation_source: 'manual', needs_review: false, is_validated: true });
    expect(byId.get(tx(2))).toMatchObject({ category_id: GROC, needs_review: false });
    expect(byId.get(tx(3))).toMatchObject({ category_id: null, categorisation_source: 'manual' });
    expect(byId.get(tx(4))).toMatchObject({ category_id: FUN, needs_review: true });
    expect(byId.get(tx(5))).toMatchObject({ category_id: FUN });
    expect(byId.get(tx(6))).toMatchObject({ category_id: null });
  });

  it('changes nothing for an ask policy', async () => {
    const body = await (await POST(req('POST'), params(ASK))).json();
    expect(body.applied).toBe(0);
  });
});
