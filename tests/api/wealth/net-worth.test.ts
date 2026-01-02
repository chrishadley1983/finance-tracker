import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/wealth/net-worth/route';

// Create a more sophisticated mock that tracks table calls
let tableCallCount: Record<string, number> = {};
let mockResponses: Record<string, { data: unknown; error: unknown }[]> = {};

function resetMockState() {
  tableCallCount = {};
  mockResponses = {};
}

function setMockResponse(table: string, responses: { data: unknown; error: unknown }[]) {
  mockResponses[table] = responses;
  tableCallCount[table] = 0;
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
      chainMock.eq = () => chainMock;
      chainMock.in = () => chainMock;
      chainMock.order = () => Promise.resolve(getNextResponse());
      chainMock.lte = () => chainMock;
      // For accounts query: eq('is_active', true) returns the response directly
      chainMock.eq = (_col: string, _val: unknown) => {
        if (table === 'accounts') {
          return Promise.resolve(getNextResponse());
        }
        return chainMock;
      };

      return chainMock;
    },
  },
}));

describe('Net Worth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      setMockResponse('investment_valuations', [
        { data: [{ account_id: 'acc-2', value: 50000, date: '2026-01-01' }], error: null },
        { data: [], error: null }, // previous
      ]);

      setMockResponse('wealth_snapshots', [
        { data: [{ account_id: 'acc-1', balance: 5000, date: '2026-01-01' }], error: null },
        { data: [], error: null }, // previous
      ]);

      setMockResponse('transactions', [
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

    it('handles investment accounts', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setMockResponse('investment_valuations', [
        { data: [{ account_id: 'acc-1', value: 100000, date: '2026-01-01' }], error: null },
        { data: [], error: null },
      ]);

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.total).toBe(100000);
    });

    it('handles accounts with no valuations returning zero', async () => {
      setMockResponse('accounts', [{
        data: [
          { id: 'acc-1', name: 'Empty ISA', type: 'investment', is_active: true },
        ],
        error: null,
      }]);

      setMockResponse('investment_valuations', [
        { data: [], error: null },
        { data: [], error: null },
      ]);

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
        { data: [], error: null },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // With no valuations, investment account should have 0 balance
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

      setMockResponse('investment_valuations', [
        { data: [{ account_id: 'acc-1', value: 50000, date: '2026-01-01' }], error: null },
        { data: [], error: null },
      ]);

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
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

      setMockResponse('investment_valuations', [
        { data: [{ account_id: 'acc-1', value: 75000, date: '2026-01-01' }], error: null },
        { data: [], error: null },
      ]);

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
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

      setMockResponse('investment_valuations', [
        { data: [{ account_id: 'acc-1', value: 110000, date: '2026-01-01' }], error: null },
        { data: [{ account_id: 'acc-1', value: 100000 }], error: null }, // previous
      ]);

      setMockResponse('wealth_snapshots', [
        { data: [], error: null },
        { data: [], error: null },
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
