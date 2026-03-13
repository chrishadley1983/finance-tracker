import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/transactions/monthly-trend/route';

// Mock Supabase
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

/**
 * Helper to set up mocks for the monthly-trend route.
 * The route makes 2 queries:
 * 1. categories - select('id').eq('exclude_from_totals', true)
 * 2. transactions - paginated select('date, amount, category_id').gte().lte().order().range()
 */
function setupMocks(options: {
  excludedCategories?: { id: string }[];
  transactions?: { date: string; amount: number; category_id: string | null }[];
  transactionError?: { message: string } | null;
} = {}) {
  const {
    excludedCategories = [],
    transactions = [],
    transactionError = null,
  } = options;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'categories') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: excludedCategories, error: null }),
        }),
      };
    }
    // transactions table - paginated query
    return {
      select: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: transactionError ? null : transactions,
                error: transactionError,
              }),
            }),
          }),
        }),
      }),
    };
  });
}

describe('Dashboard Monthly Trend API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/transactions/monthly-trend', () => {
    it('returns correct response shape for each month', async () => {
      setupMocks({
        transactions: [
          { date: '2026-03-15', amount: 1000, category_id: null },
        ],
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('month');
        expect(data[0]).toHaveProperty('income');
        expect(data[0]).toHaveProperty('expenses');
      }
    });

    it('returns 6 months by default', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(6);
    });

    it('respects months parameter', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=3');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(3);
    });

    it('respects months=12 parameter', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=12');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(12);
    });

    it('has zero values when no transactions in month', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].income).toBe(0);
      expect(data[0].expenses).toBe(0);
    });

    it('returns month labels (Jan, Feb, etc.)', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      data.forEach((item: { month: string }) => {
        expect(validMonths).toContain(item.month);
      });
    });

    it('handles empty months returning zeros', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=3');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      data.forEach((item: { income: number; expenses: number }) => {
        expect(item.income).toBe(0);
        expect(item.expenses).toBe(0);
      });
    });

    it('returns 500 on database error', async () => {
      setupMocks({
        transactionError: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('queries transactions table', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      await GET(request);

      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('also queries categories for exclusions', async () => {
      setupMocks();

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      await GET(request);

      expect(mockFrom).toHaveBeenCalledWith('categories');
    });

    it('handles null data gracefully', async () => {
      // Return null data with no error - route should treat as empty
      mockFrom.mockImplementation((table: string) => {
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      data.forEach((item: { income: number; expenses: number }) => {
        expect(item.income).toBe(0);
        expect(item.expenses).toBe(0);
      });
    });

    it('filters out transactions in excluded categories', async () => {
      const now = new Date();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentYear = now.getFullYear();
      const dateStr = `${currentYear}-${currentMonth}-15`;

      setupMocks({
        excludedCategories: [{ id: 'excluded-cat' }],
        transactions: [
          { date: dateStr, amount: -100, category_id: 'excluded-cat' },
          { date: dateStr, amount: -50, category_id: 'normal-cat' },
        ],
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Only the non-excluded transaction should be counted
      expect(data[0].expenses).toBe(50);
    });
  });
});
