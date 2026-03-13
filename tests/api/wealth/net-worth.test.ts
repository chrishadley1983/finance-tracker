import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/wealth/net-worth/route';

// Track table call counts and mock responses
let tableCallCount: Record<string, number> = {};
let mockResponses: Record<string, { data: unknown; error: unknown }[]> = {};
let rpcResponses: Record<string, { data: unknown; error: unknown }> = {};

function resetMockState() {
  tableCallCount = {};
  mockResponses = {};
  rpcResponses = {};
}

function setMockResponse(table: string, responses: { data: unknown; error: unknown }[]) {
  mockResponses[table] = responses;
  tableCallCount[table] = 0;
}

function setRpcResponse(fnName: string, response: { data: unknown; error: unknown }) {
  rpcResponses[fnName] = response;
}

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const getNextResponse = () => {
        const responses = mockResponses[table] || [{ data: null, error: null }];
        const idx = tableCallCount[table] || 0;
        tableCallCount[table] = idx + 1;
        return responses[idx] || responses[responses.length - 1];
      };

      const chainMock: Record<string, unknown> = {};
      chainMock.select = () => chainMock;
      chainMock.in = () => chainMock;
      chainMock.lte = () => chainMock;
      chainMock.order = () => Promise.resolve(getNextResponse());
      chainMock.eq = (_col: string, _val: unknown) => {
        if (table === 'accounts') {
          return Promise.resolve(getNextResponse());
        }
        return chainMock;
      };

      return chainMock;
    },
    rpc: (fnName: string) => {
      const response = rpcResponses[fnName] || { data: null, error: null };
      return Promise.resolve(response);
    },
  },
}));

describe('Net Worth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/wealth/net-worth', () => {
    it('returns correct response shape', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'Current Account', type: 'current', is_active: true },
          { id: 'acc-2', name: 'ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setRpcResponse('get_account_balances_with_snapshots', {
        data: [
          { account_id: 'acc-1', snapshot_date: '2026-01-01', snapshot_balance: 5000, transactions_sum: 0, current_balance: 5000 },
        ],
        error: null,
      });

      // Previous month snapshots
      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('date');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('previousTotal');
      expect(data).toHaveProperty('change');
      expect(data).toHaveProperty('changePercent');
      expect(data).toHaveProperty('byType');
      expect(data).toHaveProperty('byAccount');
    });

    it('returns empty result when no accounts', async () => {
      setMockResponse('accounts', [{ data: [], error: null }]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(0);
      expect(data.byType).toEqual([]);
      expect(data.byAccount).toEqual([]);
    });

    it('returns 500 on accounts query error', async () => {
      setMockResponse('accounts', [{
        data: null,
        error: { message: 'Database error' },
      }]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch accounts');
    });

    it('handles accounts with balance from snapshots', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setRpcResponse('get_account_balances_with_snapshots', {
        data: [
          { account_id: 'acc-1', snapshot_date: '2026-01-01', snapshot_balance: 100000, transactions_sum: 0, current_balance: 100000 },
        ],
        error: null,
      });

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(100000);
    });

    it('handles accounts with no balances returning zero', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'Empty ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setRpcResponse('get_account_balances_with_snapshots', {
        data: [],
        error: null,
      });

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byAccount.length).toBe(1);
      expect(data.byAccount[0].balance).toBe(0);
    });

    it('includes byType breakdown', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setRpcResponse('get_account_balances_with_snapshots', {
        data: [
          { account_id: 'acc-1', snapshot_date: '2026-01-01', snapshot_balance: 50000, transactions_sum: 0, current_balance: 50000 },
        ],
        error: null,
      });

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byType.length).toBe(1);
      expect(data.byType[0].type).toBe('investment');
      expect(data.byType[0]).toHaveProperty('label');
      expect(data.byType[0]).toHaveProperty('total');
    });

    it('includes byAccount breakdown', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'My ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setRpcResponse('get_account_balances_with_snapshots', {
        data: [
          { account_id: 'acc-1', snapshot_date: '2026-01-01', snapshot_balance: 75000, transactions_sum: 0, current_balance: 75000 },
        ],
        error: null,
      });

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byAccount.length).toBe(1);
      expect(data.byAccount[0].accountId).toBe('acc-1');
      expect(data.byAccount[0].accountName).toBe('My ISA');
      expect(data.byAccount[0].balance).toBe(75000);
    });

    it('calculates change when previous data exists', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setRpcResponse('get_account_balances_with_snapshots', {
        data: [
          { account_id: 'acc-1', snapshot_date: '2026-01-01', snapshot_balance: 110000, transactions_sum: 0, current_balance: 110000 },
        ],
        error: null,
      });

      // Previous month snapshots
      setMockResponse('wealth_snapshots', [
        { data: [{ account_id: 'acc-1', balance: 100000 }], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(110000);
      expect(data.previousTotal).toBe(100000);
      expect(data.change).toBe(10000);
      expect(data.changePercent).toBeCloseTo(10, 0);
    });
  });
});
