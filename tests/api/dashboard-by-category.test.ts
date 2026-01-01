import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/transactions/by-category/route';

// Test UUIDs
const TEST_CATEGORY_1_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_CATEGORY_2_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_CATEGORY_3_ID = '550e8400-e29b-41d4-a716-446655440003';

// Mock Supabase
const mockSelect = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockLt = vi.fn();

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('Dashboard By-Category API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    const chainMock = {
      select: mockSelect,
      gte: mockGte,
      lte: mockLte,
      lt: mockLt,
    };

    mockFrom.mockReturnValue(chainMock);
    mockSelect.mockReturnValue(chainMock);
    mockGte.mockReturnValue(chainMock);
    mockLte.mockReturnValue(chainMock);
    mockLt.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/transactions/by-category', () => {
    it('returns correct response shape for each category', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -100, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries' } },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('categoryId');
        expect(data[0]).toHaveProperty('categoryName');
        expect(data[0]).toHaveProperty('amount');
        expect(data[0]).toHaveProperty('percentage');
      }
    });

    it('returns top 8 categories only', async () => {
      const transactions = [];
      for (let i = 1; i <= 12; i++) {
        transactions.push({
          amount: -100 * i,
          category: { id: `cat-${i}`, name: `Category ${i}` },
        });
      }
      mockLt.mockResolvedValue({ data: transactions, error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBeLessThanOrEqual(8);
    });

    it('only includes expenses (negative amounts)', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -50, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries' } },
          { amount: -150, category: { id: TEST_CATEGORY_2_ID, name: 'Transport' } },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Amounts should be positive (absolute values)
      data.forEach((item: { amount: number }) => {
        expect(item.amount).toBeGreaterThan(0);
      });
    });

    it('calculates percentages correctly', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -200, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries' } },
          { amount: -100, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries' } },
          { amount: -100, category: { id: TEST_CATEGORY_2_ID, name: 'Transport' } },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Total expenses: 200 + 100 + 100 = 400
      // Groceries: 300 = 75%
      // Transport: 100 = 25%
      const groceries = data.find((c: { categoryName: string }) => c.categoryName === 'Groceries');
      const transport = data.find((c: { categoryName: string }) => c.categoryName === 'Transport');

      expect(groceries.amount).toBe(300);
      expect(groceries.percentage).toBe(75);
      expect(transport.amount).toBe(100);
      expect(transport.percentage).toBe(25);
    });

    it('filters by month parameter', async () => {
      mockLt.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category?month=2025-06');
      await GET(request);

      // Verify date filtering was called (exact dates depend on implementation)
      expect(mockGte).toHaveBeenCalled();
      expect(mockLte).toHaveBeenCalled();
    });

    it('uses current month when no month parameter provided', async () => {
      mockLt.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      await GET(request);

      expect(mockGte).toHaveBeenCalled();
      expect(mockLte).toHaveBeenCalled();
    });

    it('handles uncategorized transactions', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -100, category: null },
          { amount: -50, category: null },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].categoryId).toBe('uncategorized');
      expect(data[0].categoryName).toBe('Uncategorized');
      expect(data[0].amount).toBe(150);
    });

    it('groups transactions by category', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -50, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries' } },
          { amount: -75, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries' } },
          { amount: -100, category: { id: TEST_CATEGORY_2_ID, name: 'Transport' } },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(2);

      const groceries = data.find((c: { categoryId: string }) => c.categoryId === TEST_CATEGORY_1_ID);
      expect(groceries.amount).toBe(125); // 50 + 75
    });

    it('sorts categories by amount descending', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -50, category: { id: TEST_CATEGORY_1_ID, name: 'Small' } },
          { amount: -200, category: { id: TEST_CATEGORY_2_ID, name: 'Large' } },
          { amount: -100, category: { id: TEST_CATEGORY_3_ID, name: 'Medium' } },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].categoryName).toBe('Large');
      expect(data[1].categoryName).toBe('Medium');
      expect(data[2].categoryName).toBe('Small');
    });

    it('handles empty result for month with no expenses', async () => {
      mockLt.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('returns 500 on database error', async () => {
      mockLt.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('queries transactions with category join', async () => {
      mockLt.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      await GET(request);

      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockSelect).toHaveBeenCalled();
    });

    it('handles percentage rounding', async () => {
      mockLt.mockResolvedValue({
        data: [
          { amount: -33.33, category: { id: TEST_CATEGORY_1_ID, name: 'Cat1' } },
          { amount: -33.33, category: { id: TEST_CATEGORY_2_ID, name: 'Cat2' } },
          { amount: -33.34, category: { id: TEST_CATEGORY_3_ID, name: 'Cat3' } },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Percentages should be rounded to whole numbers
      data.forEach((item: { percentage: number }) => {
        expect(Number.isInteger(item.percentage)).toBe(true);
      });
    });
  });
});
