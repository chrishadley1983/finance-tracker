import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * A thenable proxy that models a supabase-js query builder: every method
 * returns itself, and awaiting resolves to `result`.
 */
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

// Mock the server-only sync module so routes don't pull in real DB/AI code.
const syncAccount = vi.fn();
const syncAllEnabledAccounts = vi.fn();
vi.mock('@/lib/enable-banking/sync', () => ({
  syncAccount: (...a: unknown[]) => syncAccount(...a),
  syncAllEnabledAccounts: (...a: unknown[]) => syncAllEnabledAccounts(...a),
}));

const ORIGINAL_ENV = { ...process.env };
function setConfigured(on: boolean) {
  if (on) {
    process.env.ENABLE_BANKING_APP_ID = 'test-app';
    process.env.ENABLE_BANKING_PRIVATE_KEY = 'test-key';
  } else {
    delete process.env.ENABLE_BANKING_APP_ID;
    delete process.env.ENABLE_BANKING_PRIVATE_KEY;
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

describe('POST /api/enable-banking/sync', () => {
  it('returns 503 when Enable Banking is not configured', async () => {
    setConfigured(false);
    const { POST } = await import('@/app/api/enable-banking/sync/route');
    const res = await POST(jsonReq('http://localhost/api/enable-banking/sync', 'POST', {}));
    expect(res.status).toBe(503);
  });

  it('returns 400 for an invalid accountId', async () => {
    setConfigured(true);
    const { POST } = await import('@/app/api/enable-banking/sync/route');
    const res = await POST(jsonReq('http://localhost/api/enable-banking/sync', 'POST', { accountId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
  });

  it('syncs a single account and returns totals', async () => {
    setConfigured(true);
    syncAccount.mockResolvedValue({
      accountId: '11111111-1111-4111-8111-111111111111',
      accountName: 'HSBC Joint Current Account',
      imported: 3,
      alreadyPresent: 100,
      pendingSkipped: 1,
      fetched: 104,
      dateRange: { from: '2026-01-01', to: '2026-07-01' },
      ebBalance: null,
    });
    const { POST } = await import('@/app/api/enable-banking/sync/route');
    const res = await POST(
      jsonReq('http://localhost/api/enable-banking/sync', 'POST', {
        accountId: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.totals).toEqual({ imported: 3, alreadyPresent: 100, pendingSkipped: 1 });
    expect(syncAccount).toHaveBeenCalledOnce();
  });
});

describe('GET /api/enable-banking/status', () => {
  it('returns per-account status with session validity', async () => {
    setConfigured(true);
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
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
              enable_banking_account_uid: 'uid-1',
              enable_banking_session_id: 's1',
            },
            {
              id: 'a2',
              name: 'Cash',
              type: 'current',
              sync_enabled: false,
              last_sync_at: null,
              enable_banking_account_uid: null,
              enable_banking_session_id: null,
            },
          ],
          error: null,
        });
      }
      return chain({ data: [{ id: 's1', valid_until: future, status: 'active', aspsp_name: 'HSBC' }], error: null });
    });
    const { GET } = await import('@/app/api/enable-banking/status/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    const linked = body.accounts.find((a: { id: string }) => a.id === 'a1');
    expect(linked.linked).toBe(true);
    expect(linked.sessionValid).toBe(true);
    expect(linked.needsReconsent).toBe(false);
    const unlinked = body.accounts.find((a: { id: string }) => a.id === 'a2');
    expect(unlinked.linked).toBe(false);
  });

  it('flags needsReconsent when the session has expired', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    fromImpl.mockImplementation((table: string) => {
      if (table === 'accounts') {
        return chain({
          data: [
            {
              id: 'a1',
              name: 'HSBC',
              type: 'current',
              sync_enabled: true,
              last_sync_at: null,
              enable_banking_account_uid: 'uid-1',
              enable_banking_session_id: 's1',
            },
          ],
          error: null,
        });
      }
      return chain({ data: [{ id: 's1', valid_until: past, status: 'active', aspsp_name: 'HSBC' }], error: null });
    });
    const { GET } = await import('@/app/api/enable-banking/status/route');
    const body = await (await GET()).json();
    expect(body.accounts[0].sessionValid).toBe(false);
    expect(body.accounts[0].needsReconsent).toBe(true);
  });
});

describe('POST /api/enable-banking/link', () => {
  it('returns 400 for an invalid body', async () => {
    const { POST } = await import('@/app/api/enable-banking/link/route');
    const res = await POST(jsonReq('http://localhost/api/enable-banking/link', 'POST', { financeAccountId: 'x' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/enable-banking/callback', () => {
  it('redirects to the UI with an error when code/state are missing', async () => {
    const { GET } = await import('@/app/api/enable-banking/callback/route');
    const res = await GET(new NextRequest('http://localhost/api/enable-banking/callback'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/settings/bank-sync');
    expect(location).toContain('status=error');
  });
});

describe('GET /api/enable-banking/aspsps', () => {
  it('returns 503 when not configured', async () => {
    setConfigured(false);
    const { GET } = await import('@/app/api/enable-banking/aspsps/route');
    const res = await GET(new NextRequest('http://localhost/api/enable-banking/aspsps?country=GB'));
    expect(res.status).toBe(503);
  });
});
