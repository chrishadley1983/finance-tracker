/**
 * Token refresh during a sync: only a genuinely rejected refresh token marks the connection
 * expired; transient failures leave it active so the next run retries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../helpers/fake-supabase';
import { TrueLayerError } from '@/lib/truelayer/types';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
const refresh = vi.hoisted(() => ({ impl: (() => Promise.resolve({})) as () => Promise<unknown> }));

vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));
vi.mock('@/lib/truelayer/client', () => ({ refreshAccessToken: () => refresh.impl() }));
vi.mock('@/lib/truelayer/transactions', () => ({ getAccountTransactions: async () => [], getCardTransactions: async () => [] }));
vi.mock('@/lib/truelayer/accounts', () => ({ getAccountBalance: async () => ({}), getCardBalance: async () => ({}) }));
vi.mock('@/lib/categorisation', () => ({ categoriseMultiple: async () => [], toTransactionCategoryFields: (r: unknown) => r }));

import { syncAccount, isRefreshRejected } from '@/lib/truelayer/sync';

const ACC = '00000000-0000-4000-8000-000000000001';
const CONN = '00000000-0000-4000-8000-000000000002';

function seed() {
  db.current = createFakeSupabase({
    accounts: [{ id: ACC, name: 'HSBC', type: 'current', truelayer_account_id: 'a', truelayer_connection_id: CONN, sync_enabled: true, last_sync_at: null }],
    // access token already expired, so the sync must refresh first
    truelayer_connections: [{ id: CONN, status: 'active', access_token: 'old', refresh_token: 'r1', token_expires_at: '2020-01-01T00:00:00Z' }],
    transactions: [],
  });
}
const status = () => db.current!.tables.truelayer_connections[0].status;

describe('TrueLayer token refresh', () => {
  beforeEach(seed);

  it('a network error leaves the connection active and reports a temporary failure', async () => {
    refresh.impl = () => Promise.reject(new TypeError('fetch failed'));
    await expect(syncAccount(ACC)).rejects.toMatchObject({ code: 'REFRESH_TEMPORARY' });
    expect(status()).toBe('active');
  });

  it('a TrueLayer 5xx leaves the connection active', async () => {
    refresh.impl = () => Promise.reject(new TrueLayerError('Token request failed (503)', 503, 'TOKEN', 'upstream'));
    await expect(syncAccount(ACC)).rejects.toMatchObject({ code: 'REFRESH_TEMPORARY' });
    expect(status()).toBe('active');
  });

  it('invalid_grant marks the connection expired and asks for re-consent', async () => {
    refresh.impl = () => Promise.reject(new TrueLayerError('Token request failed (400)', 400, 'TOKEN', '{"error":"invalid_grant"}'));
    await expect(syncAccount(ACC)).rejects.toMatchObject({ code: 'RECONSENT' });
    expect(status()).toBe('expired');
  });

  it('a successful refresh stores the rotated refresh token', async () => {
    refresh.impl = () => Promise.resolve({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 });
    await syncAccount(ACC, { now: new Date('2026-10-10T12:00:00Z') }).catch(() => undefined);
    expect(db.current!.tables.truelayer_connections[0]).toMatchObject({ access_token: 'new', refresh_token: 'r2', status: 'active' });
  });

  it('isRefreshRejected: only TOKEN errors that reject the grant', () => {
    expect(isRefreshRejected(new TrueLayerError('x', 401, 'TOKEN'))).toBe(true);
    expect(isRefreshRejected(new TrueLayerError('x', 400, 'TOKEN', '{"error":"invalid_grant"}'))).toBe(true);
    expect(isRefreshRejected(new TrueLayerError('x', 400, 'TOKEN', '{"error":"invalid_request"}'))).toBe(false);
    expect(isRefreshRejected(new TrueLayerError('x', 429, 'TOKEN'))).toBe(false);
    expect(isRefreshRejected(new TrueLayerError('Missing env var', 500, 'CONFIG'))).toBe(false);
    expect(isRefreshRejected(new Error('boom'))).toBe(false);
  });
});
