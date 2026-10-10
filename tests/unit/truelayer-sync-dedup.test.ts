/**
 * syncAccount against an in-memory DB that caps responses at 1,000 rows like Supabase:
 * a wide sync over an account holding more than 1,000 rows must not re-insert them.
 */
import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
const feed = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));
vi.mock('@/lib/categorisation', () => ({
  categoriseMultiple: async () => [],
  toTransactionCategoryFields: (r: unknown) => r,
}));
vi.mock('@/lib/truelayer/transactions', () => ({
  getAccountTransactions: async () => feed.rows,
  getCardTransactions: async () => feed.rows,
}));
vi.mock('@/lib/truelayer/accounts', () => ({
  getAccountBalance: async () => ({ current: 0, available: 0 }),
  getCardBalance: async () => ({ current: 0, available: 0 }),
}));
vi.mock('@/lib/truelayer/client', () => ({ refreshAccessToken: vi.fn() }));

import { syncAccount } from '@/lib/truelayer/sync';

const ACC = '00000000-0000-4000-8000-000000000001';
const CONN = '00000000-0000-4000-8000-000000000002';
const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + (i % 600) * 86_400_000).toISOString().slice(0, 10);

describe('syncAccount dedup over more than 1,000 existing rows', () => {
  it('inserts nothing when every feed transaction is already in the ledger', async () => {
    const n = 1200;
    db.current = createFakeSupabase(
      {
        accounts: [{ id: ACC, name: 'HSBC Joint', type: 'current', truelayer_account_id: 'tl-acc', truelayer_connection_id: CONN, sync_enabled: true, last_sync_at: null }],
        truelayer_connections: [{ id: CONN, status: 'active', access_token: 'tok', refresh_token: 'r', token_expires_at: '2099-01-01T00:00:00Z' }],
        transactions: Array.from({ length: n }, (_, i) => ({
          id: `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`,
          account_id: ACC,
          date: day(i),
          amount: -(i + 1),
          description: `ROW ${i}`,
          hsbc_transaction_id: `tl-${i}`,
        })),
      },
      {},
      { maxRows: 1000 },
    );
    feed.rows = Array.from({ length: n }, (_, i) => ({
      timestamp: `${day(i)}T10:00:00Z`,
      amount: i + 1,
      transaction_type: 'DEBIT',
      description: `ROW ${i}`,
      transaction_id: `tx-${i}`,
      meta: { provider_transaction_id: `tl-${i}` },
    }));

    const res = await syncAccount(ACC, { dateFrom: '2025-01-01', dateTo: '2026-10-01', now: new Date('2026-10-01T12:00:00Z') });
    expect(res.imported).toBe(0);
    expect(db.current.tables.transactions).toHaveLength(n);
  });
});
