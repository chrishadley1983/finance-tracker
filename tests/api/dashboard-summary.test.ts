import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/transactions/summary/route';
import { NextRequest } from 'next/server';

// Track call count for transactions table
let transactionsCallCount = 0;

// Mock Supabase
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function createRequest(period = 'this_month', customStart?: string, customEnd?: string): NextRequest {
  const params = new URLSearchParams();
  params.set('period', period);
  if (customStart) params.set('start', customStart);
  if (customEnd) params.set('end', customEnd);
  return new NextRequest(`http://localhost/api/transactions/summary?${params.toString()}`);
}

describe('Dashboard Summary API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionsCallCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to set up all the mocks for a successful query flow.
   * The summary route makes 5 queries:
   * 1. accounts (with or filters)
   * 2. transactions by account (with in filter)
   * 3. wealth_snapshots (with in and order)
   * 4. investment_valuations (with in and order)
   * 5. transactions for period (with gte/lte)
   */
  function setupSuccessMocks(options: {
    accounts?: { id: string; type: string; include_in_net_worth: boolean }[];
    txByAccount?: { account_id: string; amount: number }[];
    snapshots?: { account_id: string; balance: number }[];
    valuations?: { account_id: string; value: number }[];
    periodTransactions?: { amount: number }[];
  } = {}) {
    const {
      accounts = [],
      txByAccount = [],
      snapshots = [],
      valuations = [],
      periodTransactions = [],
    } = options;

    // Set up mockFrom to return appropriate chain based on table name
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'accounts':
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ data: accounts, error: null }),
              }),
            }),
          };
        case 'transactions':
          // Track calls to handle first (txByAccount) vs second (period) call
          transactionsCallCount++;
          if (transactionsCallCount === 1) {
            // First call: txByAccount
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: txByAccount, error: null }),
              }),
            };
          } else {
            // Second call: period transactions
            return {
              select: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: periodTransactions, error: null }),
                }),
              }),
            };
          }
        case 'wealth_snapshots':
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: snapshots, error: null }),
              }),
            }),
          };
        case 'investment_valuations':
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: valuations, error: null }),
              }),
            }),
          };
        default:
          return { select: vi.fn() };
      }
    });
  }

  describe('GET /api/transactions/summary', () => {
    it('returns correct response shape', async () => {
      setupSuccessMocks({
        accounts: [{ id: 'acc1', type: 'current', include_in_net_worth: true }],
        txByAccount: [{ account_id: 'acc1', amount: 1000 }],
        periodTransactions: [{ amount: 500 }, { amount: -200 }],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalBalance');
      expect(data).toHaveProperty('periodIncome');
      expect(data).toHaveProperty('periodExpenses');
      expect(data).toHaveProperty('periodNet');
      expect(data).toHaveProperty('period');
      expect(data).toHaveProperty('startDate');
      expect(data).toHaveProperty('endDate');
    });

    it('calculates totalBalance from transactions for non-investment accounts', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'acc1', type: 'current', include_in_net_worth: true },
          { id: 'acc2', type: 'savings', include_in_net_worth: true },
        ],
        txByAccount: [
          { account_id: 'acc1', amount: 1000 },
          { account_id: 'acc1', amount: -300 },
          { account_id: 'acc2', amount: 500 },
        ],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // acc1: 1000 - 300 = 700, acc2: 500, total = 1200
      expect(data.totalBalance).toBe(1200);
    });

    it('uses wealth snapshots for accounts without transactions', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'acc1', type: 'current', include_in_net_worth: true },
          { id: 'acc2', type: 'savings', include_in_net_worth: true },
        ],
        txByAccount: [
          { account_id: 'acc1', amount: 1000 },
        ],
        snapshots: [
          { account_id: 'acc2', balance: 5000 },
        ],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // acc1: 1000 from tx, acc2: 5000 from snapshot, total = 6000
      expect(data.totalBalance).toBe(6000);
    });

    it('prefers snapshots over transactions for non-investment accounts', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'acc1', type: 'current', include_in_net_worth: true },
        ],
        txByAccount: [
          { account_id: 'acc1', amount: 1000 },
        ],
        snapshots: [
          { account_id: 'acc1', balance: 2000 },
        ],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // Snapshot takes precedence: 2000 (not 1000 from tx)
      expect(data.totalBalance).toBe(2000);
    });

    it('uses investment valuations for investment accounts', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'inv1', type: 'investment', include_in_net_worth: true },
          { id: 'isa1', type: 'isa', include_in_net_worth: true },
        ],
        txByAccount: [],
        valuations: [
          { account_id: 'inv1', value: 50000 },
          { account_id: 'isa1', value: 20000 },
        ],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalBalance).toBe(70000);
    });

    it('calculates period income correctly', async () => {
      setupSuccessMocks({
        accounts: [],
        periodTransactions: [
          { amount: 3000 }, // Income
          { amount: 500 },  // Income
          { amount: -1000 }, // Expense
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodIncome).toBe(3500); // 3000 + 500
    });

    it('calculates period expenses as positive value', async () => {
      setupSuccessMocks({
        accounts: [],
        periodTransactions: [
          { amount: 1000 }, // Income
          { amount: -500 }, // Expense
          { amount: -300 }, // Expense
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodExpenses).toBe(800); // |-500| + |-300| = 800
    });

    it('calculates periodNet as income minus expenses', async () => {
      setupSuccessMocks({
        accounts: [],
        periodTransactions: [
          { amount: 3000 }, // Income
          { amount: -1200 }, // Expense
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodNet).toBe(1800); // 3000 - 1200 = 1800
    });

    it('handles empty database returning zeros', async () => {
      setupSuccessMocks({
        accounts: [],
        txByAccount: [],
        snapshots: [],
        valuations: [],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalBalance).toBe(0);
      expect(data.periodIncome).toBe(0);
      expect(data.periodExpenses).toBe(0);
      expect(data.periodNet).toBe(0);
    });

    it('handles null data returning zeros', async () => {
      // Set up mocks to return null data
      mockFrom.mockImplementation((table: string) => {
        const nullResolve = { data: null, error: null };
        transactionsCallCount++;
        switch (table) {
          case 'accounts':
            return {
              select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  or: vi.fn().mockResolvedValue(nullResolve),
                }),
              }),
            };
          case 'transactions':
            if (transactionsCallCount <= 2) {
              return {
                select: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue(nullResolve),
                }),
              };
            }
            return {
              select: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue(nullResolve),
                }),
              }),
            };
          case 'wealth_snapshots':
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue(nullResolve),
                }),
              }),
            };
          case 'investment_valuations':
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue(nullResolve),
                }),
              }),
            };
          default:
            return { select: vi.fn() };
        }
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalBalance).toBe(0);
      expect(data.periodIncome).toBe(0);
      expect(data.periodExpenses).toBe(0);
      expect(data.periodNet).toBe(0);
    });

    it('returns 500 on accounts query error', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'accounts') {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database connection failed' } }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });

    it('returns 500 on period query error', async () => {
      let txCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        switch (table) {
          case 'accounts':
            return {
              select: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  or: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          case 'transactions':
            txCallCount++;
            if (txCallCount === 1) {
              return {
                select: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              };
            }
            return {
              select: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: null, error: { message: 'Period query failed' } }),
                }),
              }),
            };
          case 'wealth_snapshots':
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          case 'investment_valuations':
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          default:
            return { select: vi.fn() };
        }
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Period query failed');
    });

    it('queries accounts table first', async () => {
      setupSuccessMocks({
        accounts: [],
        periodTransactions: [],
      });

      await GET(createRequest());

      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });

    it('handles negative net when expenses exceed income', async () => {
      setupSuccessMocks({
        accounts: [],
        periodTransactions: [
          { amount: 1000 }, // Income
          { amount: -2500 }, // Expense
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodNet).toBe(-1500); // 1000 - 2500 = -1500
    });

    it('supports different timeframe periods', async () => {
      setupSuccessMocks({
        accounts: [],
        periodTransactions: [],
      });

      const response = await GET(createRequest('last_year'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period).toBe('last_year');
    });

    it('combines multiple balance sources correctly', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'current1', type: 'current', include_in_net_worth: true },
          { id: 'savings1', type: 'savings', include_in_net_worth: true },
          { id: 'invest1', type: 'investment', include_in_net_worth: true },
          { id: 'pension1', type: 'pension', include_in_net_worth: true },
        ],
        txByAccount: [
          { account_id: 'current1', amount: 5000 },
        ],
        snapshots: [
          { account_id: 'savings1', balance: 10000 },
        ],
        valuations: [
          { account_id: 'invest1', value: 50000 },
          { account_id: 'pension1', value: 100000 },
        ],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // current1: 5000 (tx), savings1: 10000 (snapshot), invest1: 50000 (val), pension1: 100000 (val)
      expect(data.totalBalance).toBe(165000);
    });
  });
});
