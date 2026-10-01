/**
 * A5 / A8 / A9 / A10 against an in-memory finance DB: every edit path records
 * corrections and clears the review flag; answers apply + make "always"
 * stick; re-categorisation clears what the new rules can answer; learning
 * stats compute exact rates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
  createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

import { PUT as PUT_ONE } from '@/app/api/transactions/[id]/route';
import { PUT as PUT_BULK } from '@/app/api/transactions/bulk/route';
import { PATCH as PATCH_QUEUE } from '@/app/api/transactions/review-queue/route';
import { POST as POST_ANSWERS } from '@/app/api/categorisation/answers/route';
import { POST as POST_RECAT } from '@/app/api/categorisation/recategorise-pending/route';
import { GET as GET_STATS } from '@/app/api/categorisation/learning-stats/route';
import { clearRulesCache } from '@/lib/categorisation/rule-matcher';
import { computeWindowStats, topCorrectedMerchants } from '@/lib/categorisation/learning-stats';

const KEY = 'test-agent-key-0123456789';
process.env.FINANCE_AGENT_KEY = KEY;

// RFC-4122-valid ids (zod uuid)
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CAT = { groceries: u(901), coffee: u(902), eatingOut: u(903), income: u(904), transfers: u(905), social: u(906), work: u(907) };
const JOINT = u(800);
const T = { aldi: u(1), pret: u(2), stripe: u(3), gridserve: u(4), manual: u(5), bena: u(6), bena2: u(7), validated: u(8) };

function seed() {
  db.current = createFakeSupabase(
    {
      categories: [
        { id: CAT.groceries, name: 'Groceries' },
        { id: CAT.coffee, name: 'Coffee' },
        { id: CAT.eatingOut, name: 'Eating out' },
        { id: CAT.income, name: 'Chris Income' },
        { id: CAT.transfers, name: 'Transfers' },
        { id: CAT.social, name: 'Social Travel' },
        { id: CAT.work, name: 'Work Travel' },
      ],
      accounts: [{ id: JOINT, name: 'HSBC Joint Current Account' }],
      transactions: [
        { id: T.aldi, account_id: JOINT, date: '2026-09-28', amount: -30, description: 'ALDI TONBRIDGE', category_id: CAT.eatingOut, categorisation_source: 'ai', engine_source: 'ai', categorisation_confidence: 0.6, needs_review: true, is_validated: false, created_at: '2026-09-28T19:00:00Z' },
        { id: T.pret, account_id: JOINT, date: '2026-09-28', amount: -4.2, description: 'PRET A MANGER BANK', category_id: CAT.eatingOut, categorisation_source: 'rule', engine_source: 'rule_pattern', categorisation_confidence: 0.9, needs_review: false, is_validated: false, created_at: '2026-09-28T19:00:00Z' },
        { id: T.stripe, account_id: JOINT, date: '2026-09-28', amount: 22.27, description: 'Stripe Payments UKSHOPIFY', category_id: CAT.transfers, categorisation_source: 'rule', engine_source: 'rule_pattern', categorisation_confidence: 0.9, needs_review: false, is_validated: false, created_at: '2026-09-28T19:00:00Z' },
        { id: T.gridserve, account_id: JOINT, date: '2026-09-28', amount: -23.36, description: 'GRIDSERVE UK OMM LIVER', category_id: CAT.social, categorisation_source: 'rule', engine_source: 'policy_ask', categorisation_confidence: 0.5, needs_review: true, is_validated: false, created_at: '2026-09-28T19:00:00Z' },
        { id: T.manual, account_id: JOINT, date: '2026-09-20', amount: -9, description: 'FCB TONBRIDGE', category_id: CAT.coffee, categorisation_source: 'manual', engine_source: 'ai', categorisation_confidence: 0.7, needs_review: false, is_validated: false, created_at: '2026-09-20T19:00:00Z' },
        { id: T.bena, account_id: JOINT, date: '2026-09-29', amount: -18, description: 'BENA LTD Tonbridge', category_id: null, categorisation_source: 'import', engine_source: 'none', categorisation_confidence: null, needs_review: true, is_validated: false, created_at: '2026-09-29T19:00:00Z' },
        { id: T.bena2, account_id: JOINT, date: '2026-09-30', amount: -21, description: 'BENA LTD Tonbridge', category_id: null, categorisation_source: 'import', engine_source: 'none', categorisation_confidence: null, needs_review: true, is_validated: false, created_at: '2026-09-30T19:00:00Z' },
        { id: T.validated, account_id: JOINT, date: '2026-09-30', amount: -5, description: 'BENA LTD Tonbridge', category_id: null, categorisation_source: 'import', engine_source: 'none', categorisation_confidence: null, needs_review: true, is_validated: true, created_at: '2026-09-30T19:00:00Z' },
      ],
      category_mappings: [
        { id: u(500), pattern: 'gridserve', category_id: CAT.social, match_type: 'contains', confidence: 0.95, is_system: true, account_id: null, amount_sign: null, amount_min: null, amount_max: null, action: 'ask', notes: 'policy:ev-gridserve' },
      ],
      category_corrections: [],
      category_rule_events: [],
    },
    { find_similar_transactions: () => [] }
  );
  clearRulesCache();
}

const json = (url: string, method: string, body: unknown, key?: string) =>
  new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
    body: JSON.stringify(body),
  });
const row = (id: string) => db.current!.table('transactions').find((t) => t.id === id)!;
const corrections = () => db.current!.table('category_corrections');

beforeEach(seed);

describe('A5: every edit path records corrections and clears the flag', () => {
  it('PUT /api/transactions/[id]', async () => {
    const res = await PUT_ONE(json('http://x/api/transactions/1', 'PUT', { category_id: CAT.groceries }), { params: Promise.resolve({ id: T.aldi }) });
    expect(res.status).toBe(200);
    expect(row(T.aldi)).toMatchObject({ category_id: CAT.groceries, categorisation_source: 'manual', needs_review: false });
    expect(corrections()).toEqual([
      expect.objectContaining({ transaction_id: T.aldi, original_category_id: CAT.eatingOut, corrected_category_id: CAT.groceries, original_source: 'ai' }),
    ]);
  });

  it('PUT /api/transactions/bulk', async () => {
    const res = await PUT_BULK(json('http://x/api/transactions/bulk', 'PUT', { ids: [T.aldi, T.pret], update: { category_id: CAT.coffee } }));
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(2);
    for (const id of [T.aldi, T.pret]) expect(row(id)).toMatchObject({ category_id: CAT.coffee, categorisation_source: 'manual', needs_review: false });
    expect(corrections().map((c) => c.transaction_id).sort()).toEqual([T.aldi, T.pret].sort());
  });

  it('PATCH /api/transactions/review-queue', async () => {
    const res = await PATCH_QUEUE(json('http://x/api/transactions/review-queue', 'PATCH', { transactionIds: [T.aldi], categoryId: CAT.groceries }));
    expect(res.status).toBe(200);
    expect(row(T.aldi)).toMatchObject({ categorisation_source: 'manual', needs_review: false });
    expect(corrections()).toHaveLength(1);
  });

  it('POST /api/categorisation/answers', async () => {
    const res = await POST_ANSWERS(json('http://x/api/categorisation/answers', 'POST', { answers: [{ transaction_ids: [T.aldi], category_id: CAT.groceries }] }, KEY));
    expect(res.status).toBe(200);
    expect(row(T.aldi)).toMatchObject({ categorisation_source: 'manual', needs_review: false, is_validated: true });
    expect(corrections()).toHaveLength(1);
  });

  it('only the answers path validates — UI edit paths leave is_validated alone', async () => {
    await PUT_ONE(json('http://x', 'PUT', { category_id: CAT.groceries }), { params: Promise.resolve({ id: T.aldi }) });
    await PUT_BULK(json('http://x', 'PUT', { ids: [T.pret], update: { category_id: CAT.coffee } }));
    await PATCH_QUEUE(json('http://x', 'PATCH', { transactionIds: [T.bena], categoryId: CAT.groceries }));
    for (const id of [T.aldi, T.pret, T.bena]) expect(row(id).is_validated).toBe(false);
  });

  it('no correction when the previous category was already manual, or unchanged', async () => {
    await PUT_ONE(json('http://x', 'PUT', { category_id: CAT.groceries }), { params: Promise.resolve({ id: T.manual }) });
    await PUT_BULK(json('http://x', 'PUT', { ids: [T.pret], update: { category_id: CAT.eatingOut } }));
    expect(corrections()).toHaveLength(0);
    expect(row(T.pret)).toMatchObject({ categorisation_source: 'manual', needs_review: false });
  });
});

describe('A9: answers endpoint', () => {
  it('rejects requests without the agent key or a session', async () => {
    const res = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.aldi], category_id: CAT.groceries }] }, 'wrong-key'));
    expect(res.status).toBe(401);
    const res2 = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.aldi], category_id: CAT.groceries }] }));
    expect(res2.status).toBe(401);
  });

  it('an unknown category rejects the whole batch with nothing written', async () => {
    const before = JSON.stringify(db.current!.table('transactions'));
    const res = await POST_ANSWERS(
      json('http://x', 'POST', { answers: [
        { transaction_ids: [T.aldi], category_id: CAT.groceries },
        { transaction_ids: [T.pret], category_id: u(999) },
      ] }, KEY)
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(db.current!.table('transactions'))).toBe(before);
    expect(corrections()).toHaveLength(0);
  });

  it('"always" creates a merchant rule, and the queue re-run applies it to the other pending row', async () => {
    const res = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.bena], category_id: CAT.eatingOut, always: true }] }, KEY));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.results[0].rule).toMatchObject({ status: 'created', pattern: 'bena ltd tonbridge', effective: true });
    const rule = db.current!.table('category_mappings').find((r) => r.pattern === 'bena ltd tonbridge')!;
    expect(rule).toMatchObject({ category_id: CAT.eatingOut, confidence: 0.9, match_type: 'contains' });
    // A8: the other BENA row is now answerable — cleared by rule; validated row untouched.
    expect(row(T.bena2)).toMatchObject({ category_id: CAT.eatingOut, needs_review: false, engine_source: 'rule_pattern' });
    expect(row(T.validated)).toMatchObject({ category_id: null, needs_review: true });
    expect(body.recategorised).toMatchObject({ cleared: 1 });
    expect(db.current!.table('category_rule_events')).toEqual([expect.objectContaining({ event: 'created', pattern: 'bena ltd tonbridge', source: 'answers' })]);
  });

  it('"always" on a row decided by an ask-policy turns that policy into a categorise policy', async () => {
    const res = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.gridserve], category_id: CAT.work, always: true }] }, KEY));
    const body = await res.json();
    expect(body.results[0].rule).toMatchObject({ status: 'policy_updated', pattern: 'gridserve', effective: true });
    const policy = db.current!.table('category_mappings').find((r) => r.pattern === 'gridserve')!;
    expect(policy).toMatchObject({ category_id: CAT.work, action: 'categorise', is_system: true });
    expect(String(policy.notes)).toContain('answer:always');
  });

  it('"always" re-points an existing merchant rule instead of duplicating it', async () => {
    db.current!.table('category_mappings').push({ id: u(501), pattern: 'pret a manger', category_id: CAT.eatingOut, match_type: 'contains', confidence: 0.9, is_system: false, account_id: null, amount_sign: null, amount_min: null, amount_max: null, action: 'categorise', notes: 'mined:v1' });
    const res = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.pret], category_id: CAT.coffee, always: true }] }, KEY));
    expect((await res.json()).results[0].rule.status).toBe('repointed');
    const rules = db.current!.table('category_mappings').filter((r) => r.pattern === 'pret a manger');
    expect(rules).toHaveLength(1);
    expect(rules[0].category_id).toBe(CAT.coffee);
  });

  it('is idempotent: the same answers twice give the same end state (E4)', async () => {
    const body = { answers: [{ transaction_ids: [T.aldi], category_id: CAT.groceries, always: true }] };
    await POST_ANSWERS(json('http://x', 'POST', body, KEY));
    const snapshot = JSON.stringify({ t: db.current!.table('transactions'), r: db.current!.table('category_mappings') });
    const res = await POST_ANSWERS(json('http://x', 'POST', body, KEY));
    const out = await res.json();
    expect(out.results[0]).toMatchObject({ applied: 1, corrections: 0 });
    expect(out.results[0].rule.status).toBe('unchanged');
    expect(corrections()).toHaveLength(1);
    expect(db.current!.table('category_mappings').filter((r) => r.pattern === 'aldi tonbridge')).toHaveLength(1);
    expect(JSON.stringify({ t: db.current!.table('transactions'), r: db.current!.table('category_mappings') })).toBe(snapshot);
  });

  it('confirming a Done item (same category) validates it with no correction and no rule', async () => {
    const res = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.pret, T.stripe], category_id: CAT.eatingOut }] }, KEY));
    // pret is already Eating out (pure confirmation); stripe was Transfers (a fix → correction)
    const out = (await res.json()).results[0];
    expect(out).toMatchObject({ applied: 2, validated: 2, corrections: 1 });
    expect(out.rule).toBeUndefined();
    expect(row(T.pret)).toMatchObject({ category_id: CAT.eatingOut, is_validated: true, needs_review: false });
    expect(corrections().map((c) => c.transaction_id)).toEqual([T.stripe]);
    expect(db.current!.table('category_rule_events')).toHaveLength(0);
  });

  it('rows cleared by the queue re-run are NOT validated — only what Chris named', async () => {
    await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.bena], category_id: CAT.eatingOut, always: true }] }, KEY));
    expect(row(T.bena).is_validated).toBe(true);
    expect(row(T.bena2)).toMatchObject({ needs_review: false, is_validated: false });
  });

  it('reports ids that do not exist', async () => {
    const res = await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.aldi, u(777)], category_id: CAT.groceries }] }, KEY));
    expect((await res.json()).results[0]).toMatchObject({ requested: 2, applied: 1, missing: [u(777)] });
  });
});

describe('A8: recategorise-pending endpoint', () => {
  it('clears rows a new rule can answer and never touches manual/validated rows', async () => {
    db.current!.table('category_mappings').push({ id: u(502), pattern: 'bena ltd tonbridge', category_id: CAT.eatingOut, match_type: 'contains', confidence: 0.9, is_system: false, account_id: null, amount_sign: null, amount_min: null, amount_max: null, action: 'categorise', notes: null });
    const res = await POST_RECAT(new NextRequest('http://x', { method: 'POST', headers: { 'x-api-key': KEY } }));
    const body = await res.json();
    expect(res.status).toBe(200);
    // queue: aldi (ai, no rule), gridserve (ask, unchanged suggestion), bena, bena2 → validated excluded
    expect(body).toEqual({ examined: 4, changed: 2, cleared: 2 });
    expect(row(T.bena)).toMatchObject({ category_id: CAT.eatingOut, needs_review: false, categorisation_source: 'rule' });
    expect(row(T.validated).needs_review).toBe(true);
    expect(row(T.gridserve).needs_review).toBe(true);
  });
});

describe('A10: learning stats', () => {
  it('computes exact correction rates per source and window', () => {
    const rows = [
      { id: 'a', engine_source: 'ai', created_at: '2026-09-20T10:00:00Z' },
      { id: 'b', engine_source: 'ai', created_at: '2026-09-21T10:00:00Z' },
      { id: 'c', engine_source: 'ai', created_at: '2026-09-22T10:00:00Z' },
      { id: 'd', engine_source: 'rule_pattern', created_at: '2026-09-23T10:00:00Z' },
      { id: 'e', engine_source: 'policy_ask', created_at: '2026-09-23T10:00:00Z' }, // a question, not auto
      { id: 'f', engine_source: 'none', created_at: '2026-09-23T10:00:00Z' },
      { id: 'g', engine_source: 'ai', created_at: '2026-08-01T10:00:00Z' }, // outside window
    ];
    const s = computeWindowStats(rows, new Set(['a', 'b', 'e', 'g']), '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z');
    expect(s.auto).toBe(4);
    expect(s.corrected).toBe(2);
    expect(s.rate).toBe(0.5);
    expect(s.bySource.ai).toEqual({ auto: 3, corrected: 2, rate: 0.667 });
    expect(s.bySource.rule_pattern).toEqual({ auto: 1, corrected: 0, rate: 0 });
    expect(s.bySource.policy_ask).toBeUndefined();
  });

  it('ranks most-corrected merchants', () => {
    const top = topCorrectedMerchants([
      { description: 'PRET A MANGER BANK', created_at: '2026-09-01', to_category: 'Eating out' },
      { description: 'PRET A MANGER BANK )))', created_at: '2026-09-10', to_category: 'Coffee' },
      { description: 'ALDI TONBRIDGE', created_at: '2026-09-05', to_category: 'Groceries' },
    ]);
    expect(top[0]).toEqual({ merchant: 'pret a manger', corrections: 2, toCategory: 'Coffee' });
  });

  it('GET endpoint returns the documented shape', async () => {
    await POST_ANSWERS(json('http://x', 'POST', { answers: [{ transaction_ids: [T.aldi], category_id: CAT.groceries, always: true }] }, KEY));
    const res = await GET_STATS(new NextRequest('http://x/api/categorisation/learning-stats?days=30', { headers: { 'x-api-key': KEY } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['current', 'days', 'previous', 'reviewQueue', 'rules', 'topCorrectedMerchants']);
    expect(body.rules.created).toBe(1);
    expect(body.topCorrectedMerchants[0]).toMatchObject({ merchant: 'aldi tonbridge', corrections: 1, toCategory: 'Groceries' });
  });

  it('rejects a bad days parameter', async () => {
    const res = await GET_STATS(new NextRequest('http://x/api/categorisation/learning-stats?days=0', { headers: { 'x-api-key': KEY } }));
    expect(res.status).toBe(400);
  });
});
