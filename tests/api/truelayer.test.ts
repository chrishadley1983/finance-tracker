import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

function chain(result: unknown) {
  const p = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const proxy: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return p.then.bind(p);
      if (prop === 'catch') return p.catch.bind(p);
      if (prop === 'finally') return p.finally.bind(p);
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

const fromImpl = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => fromImpl(...args) },
}));

const syncAccount = vi.fn();
const syncAllEnabledAccounts = vi.fn();
vi.mock('@/lib/truelayer/sync', () => ({
  syncAccount: (...a: unknown[]) => syncAccount(...a),
  syncAllEnabledAccounts: (...a: unknown[]) => syncAllEnabledAccounts(...a),
}));

const ORIGINAL_ENV = { ...process.env };
function setConfigured(on: boolean) {
  if (on) {
    process.env.TRUELAYER_CLIENT_ID = 'personalfinance-197739';
    process.env.TRUELAYER_CLIENT_SECRET = 'test-secret';
  } else {
    delete process.env.TRUELAYER_CLIENT_ID;
    delete process.env.TRUELAYER_CLIENT_SECRET;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  fromImpl.mockImplementation(() => chain({ data: [], error: null }));
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('POST /api/truelayer/sync', () => {
  it('returns 503 when not configured', async () => {
    setConfigured(false);
    const { POST } = await import('@/app/api/truelayer/sync/route');
    const res = await POST(jsonReq('http://localhost/api/truelayer/sync', 'POST', {}));
    expect(res.status).toBe(503);
  });

  it('returns 400 for an invalid accountId', async () => {
    setConfigured(true);
    const { POST } = await import('@/app/api/truelayer/sync/route');
    const res = await POST(jsonReq('http://localhost/api/truelayer/sync', 'POST', { accountId: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('syncs one account and returns totals', async () => {
    setConfigured(true);
    syncAccount.mockResolvedValue({
      accountId: '11111111-1111-4111-8111-111111111111',
      accountName: 'HSBC Joint Current Account',
      imported: 2,
      alreadyPresent: 50,
      fetched: 52,
      dateRange: { from: '2026-01-01', to: '2026-07-01' },
      balance: null,
    });
    const { POST } = await import('@/app/api/truelayer/sync/route');
    const res = await POST(
      jsonReq('http://localhost/api/truelayer/sync', 'POST', {
        accountId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toEqual({ imported: 2, alreadyPresent: 50 });
    expect(syncAccount).toHaveBeenCalledOnce();
  });
});

describe('GET /api/truelayer/status', () => {
  it('returns per-account status; needsReconsent when connection inactive', async () => {
    setConfigured(true);
    fromImpl.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return chain({
          data: [
            {
              id: 'a1',
              name: 'HSBC Joint Current Account',
              type: 'current',
              sync_enabled: true,
              last_sync_at: '2026-07-01T00:00:00Z',
              truelayer_account_id: 'tl-1',
              truelayer_connection_id: 'c1',
            },
            {
              id: 'a2',
              name: 'HSBC Credit Card',
              type: 'credit',
              sync_enabled: true,
              last_sync_at: null,
              truelayer_account_id: 'tl-2',
              truelayer_connection_id: 'c2',
            },
          ],
          error: null,
        });
      }
      return chain({
        data: [
          { id: 'c1', status: 'active', provider_name: 'HSBC' },
          { id: 'c2', status: 'expired', provider_name: 'HSBC' },
        ],
        error: null,
      });
    });
    const { GET } = await import('@/app/api/truelayer/status/route');
    const body = await (await GET()).json();
    expect(body.configured).toBe(true);
    const a1 = body.accounts.find((a: { id: string }) => a.id === 'a1');
    const a2 = body.accounts.find((a: { id: string }) => a.id === 'a2');
    expect(a1.connectionActive).toBe(true);
    expect(a1.needsReconsent).toBe(false);
    expect(a2.connectionActive).toBe(false);
    expect(a2.needsReconsent).toBe(true);
  });
});

describe('POST /api/truelayer/link', () => {
  it('returns 400 for an invalid body', async () => {
    const { POST } = await import('@/app/api/truelayer/link/route');
    const res = await POST(jsonReq('http://localhost/api/truelayer/link', 'POST', { financeAccountId: 'x' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/truelayer/callback', () => {
  it('redirects with an error when code/state are missing', async () => {
    const { GET } = await import('@/app/api/truelayer/callback/route');
    const res = await GET(new NextRequest('http://localhost/api/truelayer/callback'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/settings/bank-sync');
    expect(location).toContain('status=error');
  });
});

describe('POST /api/truelayer/auth/start', () => {
  it('returns 503 when not configured', async () => {
    setConfigured(false);
    const { POST } = await import('@/app/api/truelayer/auth/start/route');
    const res = await POST(jsonReq('http://localhost/api/truelayer/auth/start', 'POST', {}));
    expect(res.status).toBe(503);
  });
});
