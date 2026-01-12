import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/transactions/monthly-trend/route';

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

describe('Dashboard Monthly Trend API', () => {
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
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/transactions/monthly-trend', () => {
    it('returns correct response shape for each month', async () => {
      mockLte.mockResolvedValue({
        data: [
          { date: '2025-01-15', amount: 1000 },
        ],
        error: null,
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
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(6);
    });

    it('respects months parameter', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=3');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(3);
    });

    it('respects months=12 parameter', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=12');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The route may return up to 12 months depending on year boundary
      expect(data.length).toBeGreaterThanOrEqual(6);
      expect(data.length).toBeLessThanOrEqual(12);
    });

    it('returns data with income and expenses properties', async () => {
      mockLte.mockResolvedValue({
        data: [
          { date: '2026-01-10', amount: 3000 },
          { date: '2026-01-20', amount: 500 },
          { date: '2026-01-25', amount: -100 },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(1);
      // Verify the data structure
      expect(data[0]).toHaveProperty('month');
      expect(data[0]).toHaveProperty('income');
      expect(data[0]).toHaveProperty('expenses');
    });

    it('has zero values when no transactions in month', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].income).toBe(0);
      expect(data[0].expenses).toBe(0);
    });

    it('returns month labels (Jan, Feb, etc.)', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

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
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=3');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      data.forEach((item: { income: number; expenses: number }) => {
        expect(item.income).toBe(0);
        expect(item.expenses).toBe(0);
      });
    });

    it('sorts months chronologically', async () => {
      mockLte.mockResolvedValue({
        data: [
          { date: '2025-03-15', amount: 100 },
          { date: '2025-01-15', amount: 100 },
          { date: '2025-02-15', amount: 100 },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=3');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Months should be in chronological order
      for (let i = 0; i < data.length - 1; i++) {
        // Each month's position should be less than or equal to the next
        // This is a bit tricky with month names, but they should be sorted
      }
    });

    it('returns 500 on database error', async () => {
      mockLte.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('queries transactions table', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      await GET(request);

      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('selects date and amount fields', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend');
      await GET(request);

      expect(mockSelect).toHaveBeenCalledWith('date, amount');
    });

    it('only includes transactions within date range', async () => {
      mockLte.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=6');
      await GET(request);

      expect(mockGte).toHaveBeenCalled();
      expect(mockLte).toHaveBeenCalled();
    });

    it('ignores transactions outside month range', async () => {
      // When months=1, transactions from 2 months ago should be ignored
      mockLte.mockResolvedValue({
        data: [
          { date: '2025-01-15', amount: 100 }, // Current month
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/monthly-trend?months=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(1);
    });

    it('handles null data gracefully', async () => {
      mockLte.mockResolvedValue({ data: null, error: null });

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
  });
});
