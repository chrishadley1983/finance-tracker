/**
 * Review queue v2 against an in-memory DB: suggestions (rules/precedent only,
 * never AI), plain-English reasons, merchant keys, search, and undo.
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
const categoriseMultiple = vi.hoisted(() => vi.fn());
vi.mock('@/lib/categorisation/engine', async (orig) => ({
  ...(await orig<typeof import('@/lib/categorisation/engine')>()),
  categoriseMultiple,
}));

import { GET } from '@/app/api/transactions/review-queue/route';
import { POST as RESTORE } from '@/app/api/transactions/review-queue/restore/route';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const GROC = u(901);
const EAT = u(902);

function seed() {
  db.current = createFakeSupabase({
    categories: [{ id: GROC, name: 'Groceries' }, { id: EAT, name: 'Eating out' }],
    accounts: [{ id: u(800), name: 'HSBC current' }],
    transactions: [
      { id: u(1), date: '2026-10-07', description: 'TESCO STORES 2041 LONDON', amount: -64.18, account_id: u(800), category_id: null, needs_review: true, is_validated: false, categorisation_source: 'import', categorisation_confidence: null, engine_source: null },
      { id: u(2), date: '2026-10-06', description: 'DISHOOM KINGS CROSS', amount: -88.5, account_id: u(800), category_id: EAT, needs_review: true, is_validated: false, categorisation_source: 'ai', categorisation_confidence: 0.62, engine_source: 'ai' },
      { id: u(3), date: '2026-10-05', description: 'PRET A MANGER', amount: -4.2, account_id: u(800), category_id: EAT, needs_review: true, is_validated: false, categorisation_source: 'rule', categorisation_confidence: 0.95, engine_source: 'policy_ask' },
      { id: u(4), date: '2026-10-04', description: 'SETTLED ROW', amount: -1, account_id: u(800), category_id: GROC, needs_review: false, is_validated: true, categorisation_source: 'manual', categorisation_confidence: 1, engine_source: 'manual' },
    ],
    category_corrections: [],
  });
}

const get = (qs = '') => GET(new NextRequest(`http://localhost/api/transactions/review-queue${qs}`));

describe('GET /api/transactions/review-queue (v2)', () => {
  beforeEach(() => {
    seed();
    categoriseMultiple.mockReset();
    categoriseMultiple.mockResolvedValue([{ categoryId: GROC, categoryName: 'Groceries', confidence: 0.9, source: 'similar' }]);
  });

  it('returns queue rows with suggestions, reasons and merchant keys', async () => {
    const body = await (await get()).json();
    expect(body.stats).toEqual({ total: 3, uncategorised: 1, flagged: 2 });
    const byId = Object.fromEntries(body.transactions.map((t: { id: string }) => [t.id, t]));
    expect(byId[u(1)]).toMatchObject({
      suggestion: { categoryId: GROC, categoryName: 'Groceries', source: 'similar' },
      reason: 'Similar past transactions suggest a category',
      merchant: expect.stringContaining('tesco'),
      accountName: 'HSBC current',
      categorisationSource: 'import',
    });
    expect(byId[u(2)]).toMatchObject({ suggestion: { categoryId: EAT, confidence: 0.62 }, reason: 'AI guess, not sure' });
    expect(byId[u(3)].reason).toBe('Your rule says always ask');
    expect(byId[u(4)]).toBeUndefined();
  });

  it('never uses AI for suggestions', async () => {
    await get();
    expect(categoriseMultiple).toHaveBeenCalledWith(expect.any(Array), { allowAI: false });
  });

  it('filters and searches', async () => {
    expect((await (await get('?filter=uncategorised')).json()).transactions.map((t: { id: string }) => t.id)).toEqual([u(1)]);
    expect((await (await get('?filter=flagged')).json()).transactions).toHaveLength(2);
    expect((await (await get('?search=dish')).json()).transactions.map((t: { id: string }) => t.id)).toEqual([u(2)]);
  });

  it('still returns rows if suggestions fail', async () => {
    categoriseMultiple.mockRejectedValue(new Error('rpc down'));
    const body = await (await get()).json();
    expect(body.transactions).toHaveLength(3);
    expect(body.transactions.find((t: { id: string }) => t.id === u(1)).reason).toBe('No rule or past match');
  });
});

describe('POST /api/transactions/review-queue/restore', () => {
  beforeEach(seed);

  it('puts rows back and drops the corrections the undone action recorded', async () => {
    const tx = db.current!.tables.transactions.find((t) => t.id === u(2))!;
    Object.assign(tx, { category_id: GROC, needs_review: false, is_validated: true, categorisation_source: 'manual' });
    db.current!.tables.category_corrections.push(
      { id: 'old', transaction_id: u(2), created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'new', transaction_id: u(2), created_at: new Date().toISOString() }
    );
    const res = await RESTORE(
      new NextRequest('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({
          since: new Date(Date.now() - 60_000).toISOString(),
          rows: [{ id: u(2), category_id: EAT, categorisation_source: 'ai', engine_source: 'ai', categorisation_confidence: 0.62, needs_review: true, is_validated: false }],
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(tx).toMatchObject({ category_id: EAT, needs_review: true, is_validated: false, categorisation_source: 'ai' });
    expect(db.current!.tables.category_corrections.map((c) => c.id)).toEqual(['old']);
  });

  it('rejects malformed input', async () => {
    const res = await RESTORE(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ rows: [] }) }));
    expect(res.status).toBe(400);
  });
});
