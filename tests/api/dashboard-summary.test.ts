import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/transactions/summary/route';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

function createRequest(period = 'this_month', customStart?: string, customEnd?: string): NextRequest {
  const params = new URLSearchParams();
  params.set('period', period);
  if (customStart) params.set('start', customStart);
  if (customEnd) params.set('end', customEnd);
  return new NextRequest(`http://localhost/api/transactions/summary?${params.toString()}`);
}

/**
 * The summary route makes these queries:
 * 1. accounts - .from('accounts').select(...).or(...).or(...)
 * 2. rpc('get_account_transaction_stats', ...) - tx balances
 * 3. rpc('get_account_balances_with_snapshots', ...) - snapshot + tx balances
 * 4. investment_valuations - .from('investment_valuations').select(...).in(...).order(...)
 * 5. categories - .from('categories').select('id, is_income, exclude_from_totals')
 * 6. transactions (paginated) - .from('transactions').select(...).gte(...).lte(...).order(...).range(...)
 */
function setupSuccessMocks(options: {
  accounts?: { id: string; type: string; include_in_net_worth: boolean }[];
  txStats?: { account_id: string; tx_count: number; earliest_date: string | null; latest_date: string | null; balance: number }[];
  snapshotBalances?: { account_id: string; snapshot_date: string; snapshot_balance: number; transactions_sum: number; current_balance: number }[];
  valuations?: { account_id: string; value: number }[];
  categories?: { id: string; is_income: boolean; exclude_from_totals: boolean }[];
  periodTransactions?: { amount: number; category_id: string | null }[];
} = {}) {
  const {
    accounts = [],
    txStats = [],
    snapshotBalances = [],
    valuations = [],
    categories = [],
    periodTransactions = [],
  } = options;

  // RPC calls
  let rpcCallCount = 0;
  mockRpc.mockImplementation((fnName: string) => {
    rpcCallCount++;
    if (fnName === 'get_account_transaction_stats') {
      return Promise.resolve({ data: txStats, error: null });
    }
    if (fnName === 'get_account_balances_with_snapshots') {
      return Promise.resolve({ data: snapshotBalances, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  // From calls
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
      case 'investment_valuations':
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: valuations, error: null }),
            }),
          }),
        };
      case 'categories':
        return {
          select: vi.fn().mockResolvedValue({ data: categories, error: null }),
        };
      case 'transactions':
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: periodTransactions, error: null }),
                }),
              }),
            }),
          }),
        };
      default:
        return { select: vi.fn() };
    }
  });
}

describe('Dashboard Summary API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/transactions/summary', () => {
    it('returns correct response shape', async () => {
      setupSuccessMocks({
        accounts: [{ id: 'acc1', type: 'current', include_in_net_worth: true }],
        periodTransactions: [{ amount: 500, category_id: null }, { amount: -200, category_id: null }],
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

    it('calculates totalBalance from snapshot balances', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'acc1', type: 'current', include_in_net_worth: true },
          { id: 'acc2', type: 'savings', include_in_net_worth: true },
        ],
        snapshotBalances: [
          { account_id: 'acc1', snapshot_date: '2026-01-01', snapshot_balance: 700, transactions_sum: 0, current_balance: 700 },
          { account_id: 'acc2', snapshot_date: '2026-01-01', snapshot_balance: 500, transactions_sum: 0, current_balance: 500 },
        ],
        periodTransactions: [],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // acc1: 700, acc2: 500, total = 1200
      expect(data.totalBalance).toBe(1200);
    });

    it('uses investment valuations for investment accounts', async () => {
      setupSuccessMocks({
        accounts: [
          { id: 'inv1', type: 'investment', include_in_net_worth: true },
          { id: 'isa1', type: 'isa', include_in_net_worth: true },
        ],
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

    it('calculates period expenses as positive value (non-income categories)', async () => {
      setupSuccessMocks({
        accounts: [],
        categories: [
          { id: 'income-cat', is_income: true, exclude_from_totals: false },
        ],
        periodTransactions: [
          { amount: 1000, category_id: 'income-cat' }, // Income
          { amount: -500, category_id: 'expense-cat' }, // Expense
          { amount: -300, category_id: null }, // No category - treated as expense
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodIncome).toBe(1000);
      expect(data.periodExpenses).toBe(800); // |-500| + |-300|
    });

    it('calculates periodNet as income minus expenses', async () => {
      setupSuccessMocks({
        accounts: [],
        categories: [
          { id: 'income-cat', is_income: true, exclude_from_totals: false },
        ],
        periodTransactions: [
          { amount: 3000, category_id: 'income-cat' },
          { amount: -1200, category_id: null },
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodNet).toBe(1800); // 3000 - 1200
    });

    it('handles empty database returning zeros', async () => {
      setupSuccessMocks({
        accounts: [],
        txStats: [],
        snapshotBalances: [],
        valuations: [],
        categories: [],
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

    it('returns 500 on accounts query error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });
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
      mockRpc.mockResolvedValue({ data: [], error: null });
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
          case 'investment_valuations':
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          case 'categories':
            return {
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          case 'transactions':
            return {
              select: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      range: vi.fn().mockResolvedValue({ data: null, error: { message: 'Period query failed' } }),
                    }),
                  }),
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
        categories: [
          { id: 'income-cat', is_income: true, exclude_from_totals: false },
        ],
        periodTransactions: [
          { amount: 1000, category_id: 'income-cat' },
          { amount: -2500, category_id: null },
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodNet).toBe(-1500); // 1000 - 2500
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
        txStats: [
          { account_id: 'current1', tx_count: 1, earliest_date: null, latest_date: null, balance: 5000 },
        ],
        snapshotBalances: [
          { account_id: 'savings1', snapshot_date: '2026-01-01', snapshot_balance: 10000, transactions_sum: 0, current_balance: 10000 },
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
      // current1: 5000 (tx - no snapshot), savings1: 10000 (snapshot), invest1: 50000 (val), pension1: 100000 (val)
      expect(data.totalBalance).toBe(165000);
    });

    it('does not count credits in expense categories as expenses (refunds)', async () => {
      // A refund (credit) sitting in an expense category must not inflate
      // periodExpenses; SpendingByCategory only sums debits, so summary
      // must match. Regression for the £1,563.73 mismatch.
      setupSuccessMocks({
        accounts: [],
        categories: [
          { id: 'income-cat', is_income: true, exclude_from_totals: false },
          { id: 'travel-cat', is_income: false, exclude_from_totals: false },
        ],
        periodTransactions: [
          { amount: -500, category_id: 'travel-cat' }, // £500 holiday spend
          { amount: 100, category_id: 'travel-cat' },  // £100 refund
          { amount: 1000, category_id: 'income-cat' }, // income, unrelated
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodExpenses).toBe(500); // not 600
      expect(data.periodIncome).toBe(1000);
    });

    it('does not count debits in income categories as income (reversals)', async () => {
      setupSuccessMocks({
        accounts: [],
        categories: [
          { id: 'income-cat', is_income: true, exclude_from_totals: false },
        ],
        periodTransactions: [
          { amount: 1000, category_id: 'income-cat' },
          { amount: -50, category_id: 'income-cat' }, // income reversal
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.periodIncome).toBe(1000); // not 1050
    });

    it('excludes transactions in excluded categories from totals', async () => {
      setupSuccessMocks({
        accounts: [],
        categories: [
          { id: 'excluded-cat', is_income: false, exclude_from_totals: true },
          { id: 'normal-cat', is_income: false, exclude_from_totals: false },
        ],
        periodTransactions: [
          { amount: -100, category_id: 'excluded-cat' },
          { amount: -200, category_id: 'normal-cat' },
        ],
      });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      // Only normal-cat should count
      expect(data.periodExpenses).toBe(200);
    });
  });
});
