import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/transactions/by-category/route';

// Test UUIDs
const TEST_CATEGORY_1_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_CATEGORY_2_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_CATEGORY_3_ID = '550e8400-e29b-41d4-a716-446655440003';

// Mock Supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('Dashboard By-Category API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: categories query returns empty excluded list
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }));

    // Default: RPC returns empty
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/transactions/by-category', () => {
    it('returns correct response shape for each category', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { category_id: TEST_CATEGORY_1_ID, category_name: 'Groceries', total_amount: -100 },
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

    it('only includes expenses (negative amounts become positive)', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { category_id: TEST_CATEGORY_1_ID, category_name: 'Groceries', total_amount: -50 },
          { category_id: TEST_CATEGORY_2_ID, category_name: 'Transport', total_amount: -150 },
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
      mockRpc.mockResolvedValue({
        data: [
          { category_id: TEST_CATEGORY_1_ID, category_name: 'Groceries', total_amount: -300 },
          { category_id: TEST_CATEGORY_2_ID, category_name: 'Transport', total_amount: -100 },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Total expenses: 300 + 100 = 400
      // Groceries: 300 = 75%
      // Transport: 100 = 25%
      const groceries = data.find((c: { categoryName: string }) => c.categoryName === 'Groceries');
      const transport = data.find((c: { categoryName: string }) => c.categoryName === 'Transport');

      expect(groceries.amount).toBe(300);
      expect(groceries.percentage).toBe(75);
      expect(transport.amount).toBe(100);
      expect(transport.percentage).toBe(25);
    });

    it('handles uncategorized transactions', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { category_id: null, category_name: null, total_amount: -150 },
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

    it('sorts categories by amount descending', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { category_id: TEST_CATEGORY_1_ID, category_name: 'Small', total_amount: -50 },
          { category_id: TEST_CATEGORY_2_ID, category_name: 'Large', total_amount: -200 },
          { category_id: TEST_CATEGORY_3_ID, category_name: 'Medium', total_amount: -100 },
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
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('calls rpc with get_spending_by_category', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      await GET(request);

      expect(mockRpc).toHaveBeenCalledWith('get_spending_by_category', expect.any(Object));
    });

    it('handles percentage rounding', async () => {
      mockRpc.mockResolvedValue({
        data: [
          { category_id: TEST_CATEGORY_1_ID, category_name: 'Cat1', total_amount: -33.33 },
          { category_id: TEST_CATEGORY_2_ID, category_name: 'Cat2', total_amount: -33.33 },
          { category_id: TEST_CATEGORY_3_ID, category_name: 'Cat3', total_amount: -33.34 },
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

    it('falls back to client-side aggregation on RPC error', async () => {
      // RPC fails
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'function does not exist' },
      });

      // Fallback: categories query + transactions query with range
      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        // transactions table - paginated query
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [
                      { amount: -100, category: { id: TEST_CATEGORY_1_ID, name: 'Groceries', exclude_from_totals: false } },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      });

      const request = new NextRequest('http://localhost/api/transactions/by-category');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].categoryName).toBe('Groceries');
      expect(data[0].amount).toBe(100);
    });
  });
});
