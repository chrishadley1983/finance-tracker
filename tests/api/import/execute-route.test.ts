/**
 * POST /api/import/execute against an in-memory DB: engine sources the
 * preview sends (incl. policy rules) are accepted, low-confidence guesses
 * land in review, confidence is kept, rows are inserted in batches with one
 * hash each, and a re-import of the same rows is fully deduplicated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));
vi.mock('@/lib/import', () => ({ deleteSessionData: () => {} }));

import { POST } from '@/app/api/import/execute/route';
import { importHash } from '@/lib/import/dedup';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SESSION = u(1);
const ACCOUNT = u(2);
const CAT = u(3);

function seed() {
  db.current = createFakeSupabase({
    import_sessions: [{ id: SESSION, status: 'pending' }],
    accounts: [{ id: ACCOUNT }],
    transactions: [],
    imported_transaction_hashes: [],
  });
}

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  rowNumber: n,
  date: '2026-09-0' + ((n % 9) + 1),
  amount: -10 - n,
  description: `SHOP ${n}`,
  rawData: { line: String(n) },
  ...extra,
});

function req(transactions: unknown[]) {
  return new NextRequest('http://localhost/api/import/execute', {
    method: 'POST',
    body: JSON.stringify({ sessionId: SESSION, accountId: ACCOUNT, transactions, skipDuplicates: true }),
  });
}

describe('POST /api/import/execute', () => {
  beforeEach(seed);

  it('accepts policy-rule sources (previously rejected the whole import)', async () => {
    const res = await POST(
      req([
        row(1, { categoryId: CAT, categorisationSource: 'policy', categorisationConfidence: 0.95 }),
        row(2, { categoryId: CAT, categorisationSource: 'policy_ask', categorisationConfidence: 0.9, needsReview: true }),
      ])
    );
    expect(res.status).toBe(200);
    const tx = db.current!.tables.transactions;
    expect(tx).toHaveLength(2);
    expect(tx[0]).toMatchObject({ categorisation_source: 'rule', engine_source: 'policy', needs_review: false });
    expect(tx[1]).toMatchObject({ categorisation_source: 'rule', engine_source: 'policy_ask', needs_review: true });
  });

  it('sends low-confidence guesses to review and keeps the confidence', async () => {
    await POST(
      req([
        row(1, { categoryId: CAT, categorisationSource: 'ai', categorisationConfidence: 0.55 }),
        row(2, { categoryId: CAT, categorisationSource: 'rule_exact', categorisationConfidence: 0.99 }),
        row(3, { categoryId: CAT, categorisationSource: 'manual', categorisationConfidence: 1 }),
        row(4),
      ])
    );
    const byDesc = Object.fromEntries(db.current!.tables.transactions.map((t) => [t.description, t]));
    expect(byDesc['SHOP 1']).toMatchObject({ needs_review: true, categorisation_confidence: 0.55, categorisation_source: 'ai' });
    expect(byDesc['SHOP 2']).toMatchObject({ needs_review: false, categorisation_confidence: 0.99 });
    expect(byDesc['SHOP 3']).toMatchObject({ needs_review: false, categorisation_source: 'manual' });
    expect(byDesc['SHOP 4']).toMatchObject({ needs_review: true, category_id: null, categorisation_source: 'import' });
  });

  it('inserts large files in batches, one hash per row, and dedups a re-import', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => ({ ...row(i + 1), description: `SHOP ${i + 1}` }));
    const first = await (await POST(req(rows))).json();
    expect(first).toMatchObject({ imported: 450, failed: 0 });
    expect(db.current!.tables.transactions).toHaveLength(450);
    const hashes = db.current!.tables.imported_transaction_hashes;
    expect(hashes).toHaveLength(450);
    expect(hashes[0].hash).toBe(importHash(rows[0].date, rows[0].amount, rows[0].description));

    db.current!.tables.import_sessions[0].status = 'pending';
    const second = await (await POST(req(rows))).json();
    expect(second).toMatchObject({ imported: 0, skipped: 450 });
    expect(db.current!.tables.transactions).toHaveLength(450);
  });

  it('dedups a re-import of more than 1,000 rows (the existing-row read is paged)', async () => {
    db.current = createFakeSupabase(
      { import_sessions: [{ id: SESSION, status: 'pending' }], accounts: [{ id: ACCOUNT }], transactions: [], imported_transaction_hashes: [] },
      {},
      { maxRows: 1000 }, // behave like Supabase: an unpaged read silently stops at 1,000 rows
    );
    const rows = Array.from({ length: 1200 }, (_, i) => ({ ...row(i + 1), description: `SHOP ${i + 1}` }));
    await POST(req(rows));
    expect(db.current!.tables.transactions).toHaveLength(1200);
    db.current!.tables.import_sessions[0].status = 'pending';
    const second = await (await POST(req(rows))).json();
    expect(second).toMatchObject({ imported: 0, skipped: 1200 });
    expect(db.current!.tables.transactions).toHaveLength(1200);
  });

  it('skips CSV rows the bank feed already synced under its own wording and date', async () => {
    db.current!.tables.transactions.push(
      { id: u(100), account_id: ACCOUNT, date: '2026-09-05', amount: -11, description: 'CARD PAYMENT TO SHOP ONE', hsbc_transaction_id: 'tl-1' },
      { id: u(101), account_id: ACCOUNT, date: '2026-09-09', amount: -99, description: 'UNRELATED', hsbc_transaction_id: 'tl-2' },
    );
    // row(1): 2026-09-02, -11 → feed row 3 days later with the same amount: already held
    // row(2): 2026-09-03, -12 → no feed row with that amount: inserted
    const res = await (await POST(req([row(1), row(2)]))).json();
    expect(res).toMatchObject({ imported: 1, skipped: 1 });
    const descs = db.current!.tables.transactions.map((t) => t.description).sort();
    expect(descs).toEqual(['CARD PAYMENT TO SHOP ONE', 'SHOP 2', 'UNRELATED']);
  });
});
