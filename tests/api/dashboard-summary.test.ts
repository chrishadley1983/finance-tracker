import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/transactions/summary/route';

// Mock Supabase
const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('Dashboard Summary API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    const chainMock = {
      select: mockSelect,
      gte: mockGte,
      lte: mockLte,
    };

    mockFrom.mockReturnValue(chainMock);
    mockSelect.mockReturnValue(chainMock);
    mockGte.mockReturnValue(chainMock);
    mockLte.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/transactions/summary', () => {
    it('returns correct response shape', async () => {
      // Mock balance data (all transactions)
      mockSelect.mockReturnValueOnce(Promise.resolve({
        data: [
          { amount: 1000 },
          { amount: -500 },
          { amount: 2000 },
        ],
        error: null,
      }));

      // Mock month data (current month transactions)
      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [
            { amount: 500 },
            { amount: -200 },
          ],
          error: null,
        }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalBalance');
      expect(data).toHaveProperty('monthIncome');
      expect(data).toHaveProperty('monthExpenses');
      expect(data).toHaveProperty('monthNet');
    });

    it('calculates totalBalance from all transactions', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({
        data: [
          { amount: 1000 },
          { amount: -300 },
          { amount: 500 },
          { amount: -100 },
        ],
        error: null,
      }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalBalance).toBe(1100); // 1000 - 300 + 500 - 100 = 1100
    });

    it('calculates monthly income correctly', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [
            { amount: 3000 }, // Income
            { amount: 500 },  // Income
            { amount: -1000 }, // Expense
          ],
          error: null,
        }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.monthIncome).toBe(3500); // 3000 + 500
    });

    it('calculates monthly expenses as positive value', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [
            { amount: 1000 }, // Income
            { amount: -500 }, // Expense
            { amount: -300 }, // Expense
          ],
          error: null,
        }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.monthExpenses).toBe(800); // |-500| + |-300| = 800
    });

    it('calculates monthNet as income minus expenses', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [
            { amount: 3000 }, // Income
            { amount: -1200 }, // Expense
          ],
          error: null,
        }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.monthNet).toBe(1800); // 3000 - 1200 = 1800
    });

    it('handles empty database returning zeros', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalBalance).toBe(0);
      expect(data.monthIncome).toBe(0);
      expect(data.monthExpenses).toBe(0);
      expect(data.monthNet).toBe(0);
    });

    it('handles null data returning zeros', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalBalance).toBe(0);
      expect(data.monthIncome).toBe(0);
      expect(data.monthExpenses).toBe(0);
      expect(data.monthNet).toBe(0);
    });

    it('returns 500 on balance query error', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({
        data: null,
        error: { message: 'Database connection failed' },
      }));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });

    it('returns 500 on month query error', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Month query failed' },
        }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Month query failed');
    });

    it('queries transactions table for balance', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      await GET();

      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('handles negative net when expenses exceed income', async () => {
      mockSelect.mockReturnValueOnce(Promise.resolve({ data: [], error: null }));

      const monthChain = {
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [
            { amount: 1000 }, // Income
            { amount: -2500 }, // Expense
          ],
          error: null,
        }),
      };
      mockSelect.mockReturnValueOnce(monthChain);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.monthNet).toBe(-1500); // 1000 - 2500 = -1500
    });
  });
});
